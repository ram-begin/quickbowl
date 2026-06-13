package com.quickbowl.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.quickbowl.dto.OrderItemDto;
import com.quickbowl.dto.OrderRequest;
import com.quickbowl.dto.OrderStatusUpdate;
import com.quickbowl.model.Order;
import com.quickbowl.repository.OrderRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class OrderService {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private RestTemplate restTemplate;

    @Value("${app.restaurant-service.url}")
    private String restaurantServiceUrl;

    @Value("${app.order.free-cancellation-minutes}")
    private int freeCancellationMinutes;

    @Value("${app.order.penalty-percent}")
    private int penaltyPercent;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // ── Place Order ───────────────────────────────────
    public Order placeOrder(OrderRequest req) throws Exception {

        // Get surge + discount from Restaurant Service
        Map restaurantData = restTemplate.getForObject(
            restaurantServiceUrl + "/api/restaurants/" + req.getRestaurantId(),
            Map.class
        );

        Map data = (Map) restaurantData.get("data");
        double surgeMultiplier = ((Number) data.getOrDefault("surge_multiplier", 1.0)).doubleValue();
        boolean isSurge = (boolean) data.getOrDefault("is_surge", false);

        // Calculate subtotal
        double subtotal = req.getItems().stream()
            .mapToDouble(i -> i.getPrice() * i.getQuantity())
            .sum();

        // Apply surge
        double surgeAmount = isSurge ? Math.round((subtotal * (surgeMultiplier - 1.0)) * 100.0) / 100.0 : 0.0;

        // Apply discount if requested
        double discountPercent = 0;
        double discountAmount = 0;
        boolean discountUsed = false;

        if (req.getUseDiscount()) {
            Map discountStatus = restTemplate.getForObject(
                restaurantServiceUrl + "/api/restaurants/discount/active",
                Map.class
            );
            Map discountData = (Map) discountStatus.get("data");
            boolean discountActive = (boolean) discountData.getOrDefault("active", false);

            if (discountActive) {
                discountPercent = ((Number) discountData.getOrDefault("percent", 0)).doubleValue();
                discountAmount = Math.round((subtotal * discountPercent / 100) * 100.0) / 100.0;
                discountUsed = true;

                // Notify restaurant service to use one slot
                restTemplate.postForObject(
                    restaurantServiceUrl + "/api/restaurants/discount/use",
                    null, Map.class
                );
            }
        }

        // Delivery fee
        double deliveryFee = 30.0;
        if (subtotal > 500) deliveryFee = 0.0; // Free delivery above ₹500

        // Total
        double total = subtotal + surgeAmount - discountAmount + deliveryFee;
        total = Math.round(total * 100.0) / 100.0;

        // Scheduled order validation
        if (req.getIsScheduled() && req.getScheduledFor() != null) {
            LocalDateTime maxSchedule = LocalDateTime.now().plusDays(7);
            if (req.getScheduledFor().isBefore(LocalDateTime.now().plusMinutes(30))) {
                throw new Exception("Scheduled time must be at least 30 minutes from now");
            }
            if (req.getScheduledFor().isAfter(maxSchedule)) {
                throw new Exception("Cannot schedule more than 7 days in advance");
            }
        }

        // Build order
        Order order = new Order();
        order.setUserId(req.getUserId());
        order.setRestaurantId(req.getRestaurantId());
        order.setRestaurantName(req.getRestaurantName());
        order.setRestaurantCity(req.getRestaurantCity());
        order.setItems(objectMapper.writeValueAsString(req.getItems()));
        order.setSubtotal(subtotal);
        order.setSurgeMultiplier(surgeMultiplier);
        order.setSurgeAmount(surgeAmount);
        order.setDiscountPercent(discountPercent);
        order.setDiscountAmount(discountAmount);
        order.setDiscountUsed(discountUsed);
        order.setDeliveryFee(deliveryFee);
        order.setTotalAmount(total);
        order.setDeliveryAddress(req.getDeliveryAddress());
        order.setDeliveryPhone(req.getDeliveryPhone());
        order.setIsScheduled(req.getIsScheduled());
        order.setScheduledFor(req.getScheduledFor());
        order.setStatus(req.getIsScheduled() ? "SCHEDULED" : "PENDING");
        order.setEstimatedDelivery(LocalDateTime.now().plusMinutes(45));
        order.setPenaltyApplied(false);
        order.setPenaltyAmount(0.0);

        return orderRepository.save(order);
    }

    // ── Get Order ─────────────────────────────────────
    public Order getOrder(Long id) throws Exception {
        return orderRepository.findById(id)
            .orElseThrow(() -> new Exception("Order not found"));
    }

    // ── Get User Orders ───────────────────────────────
    public List<Order> getUserOrders(String userId) {
        return orderRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    // ── Get Restaurant Orders ─────────────────────────
    public List<Order> getRestaurantOrders(String restaurantId) {
        return orderRepository.findByRestaurantIdOrderByCreatedAtDesc(restaurantId);
    }

    // ── Update Order Status ───────────────────────────
    public Order updateStatus(Long id, OrderStatusUpdate update) throws Exception {
        Order order = getOrder(id);
        String newStatus = update.getStatus().toUpperCase();

        // Validate transition
        validateStatusTransition(order.getStatus(), newStatus);

        order.setStatus(newStatus);

        if (newStatus.equals("DELIVERED")) {
            order.setDeliveredAt(LocalDateTime.now());
            if (update.getDeliveryMinutes() != null) {
                order.setActualDeliveryMinutes(update.getDeliveryMinutes());
            }
            // Notify restaurant service to update stats
            notifyRestaurantStats(order, true);
        }

        if (newStatus.equals("CANCELLED")) {
            order.setCancellationReason(update.getReason());
            order.setCancelledAt(LocalDateTime.now());

            // Check penalty
            long minutesSinceOrder = ChronoUnit.MINUTES.between(order.getCreatedAt(), LocalDateTime.now());
            if (minutesSinceOrder > freeCancellationMinutes && !order.getIsScheduled()) {
                double penalty = Math.round((order.getTotalAmount() * penaltyPercent / 100) * 100.0) / 100.0;
                order.setPenaltyApplied(true);
                order.setPenaltyAmount(penalty);
            }

            notifyRestaurantStats(order, false);
        }

        return orderRepository.save(order);
    }

    // ── Cancel Order ──────────────────────────────────
    public Order cancelOrder(Long id, String reason) throws Exception {
        OrderStatusUpdate update = new OrderStatusUpdate();
        update.setStatus("CANCELLED");
        update.setReason(reason);
        return updateStatus(id, update);
    }

    // ── Validate Status Transition ────────────────────
    private void validateStatusTransition(String current, String next) throws Exception {
        Map<String, List<String>> allowed = Map.of(
            "PENDING",          List.of("CONFIRMED", "CANCELLED"),
            "SCHEDULED",        List.of("PENDING", "CANCELLED"),
            "CONFIRMED",        List.of("PREPARING", "CANCELLED"),
            "PREPARING",        List.of("OUT_FOR_DELIVERY"),
            "OUT_FOR_DELIVERY", List.of("DELIVERED"),
            "DELIVERED",        List.of(),
            "CANCELLED",        List.of()
        );

        List<String> allowedNext = allowed.getOrDefault(current, List.of());
        if (!allowedNext.contains(next)) {
            throw new Exception("Cannot transition from " + current + " to " + next);
        }
    }

    // ── Notify Restaurant Stats ───────────────────────
    private void notifyRestaurantStats(Order order, boolean completed) {
        try {
            boolean isPeakHour = isPeakHour();
            Map<String, Object> stats = Map.of(
                "order_completed",  completed,
                "order_cancelled",  !completed,
                "order_amount",     order.getTotalAmount(),
                "is_peak_hour",     isPeakHour,
                "delivery_minutes", order.getActualDeliveryMinutes() != null
                    ? order.getActualDeliveryMinutes() : 35
            );

            restTemplate.postForObject(
                restaurantServiceUrl + "/api/restaurants/" + order.getRestaurantId() + "/stats",
                stats,
                Map.class
            );
        } catch (Exception e) {
            System.out.println("Warning: Could not notify restaurant stats: " + e.getMessage());
        }
    }

    private boolean isPeakHour() {
        int hour = LocalDateTime.now().getHour();
        return (hour >= 12 && hour <= 14) || (hour >= 19 && hour <= 21);
    }

    // ── Process Scheduled Orders (runs every minute) ──
    @Scheduled(fixedRate = 60000)
    public void processScheduledOrders() {
        List<Order> due = orderRepository
            .findByIsScheduledTrueAndStatusAndScheduledForBefore("SCHEDULED", LocalDateTime.now());

        for (Order order : due) {
            order.setStatus("PENDING");
            orderRepository.save(order);
            System.out.println("✅ Scheduled order #" + order.getId() + " activated");
        }
    }
}