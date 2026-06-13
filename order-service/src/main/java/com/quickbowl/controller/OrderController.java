package com.quickbowl.controller;

import com.quickbowl.dto.OrderRequest;
import com.quickbowl.dto.OrderStatusUpdate;
import com.quickbowl.model.Order;
import com.quickbowl.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@CrossOrigin(origins = "*")
public class OrderController {

    @Autowired
    private OrderService orderService;

    // ── Place Order ───────────────────────────────────
    // POST /api/orders
    @PostMapping
    public ResponseEntity<?> placeOrder(@RequestBody OrderRequest req) {
        try {
            Order order = orderService.placeOrder(req);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Order placed successfully",
                "data",    order
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    // ── Get Order by ID ───────────────────────────────
    // GET /api/orders/{id}
    @GetMapping("/{id}")
    public ResponseEntity<?> getOrder(@PathVariable Long id) {
        try {
            Order order = orderService.getOrder(id);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "data",    order
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    // ── Get User Orders ───────────────────────────────
    // GET /api/orders/user/{userId}
    @GetMapping("/user/{userId}")
    public ResponseEntity<?> getUserOrders(@PathVariable String userId) {
        List<Order> orders = orderService.getUserOrders(userId);
        return ResponseEntity.ok(Map.of(
            "success", true,
            "count",   orders.size(),
            "data",    orders
        ));
    }

    // ── Get Restaurant Orders ─────────────────────────
    // GET /api/orders/restaurant/{restaurantId}
    @GetMapping("/restaurant/{restaurantId}")
    public ResponseEntity<?> getRestaurantOrders(@PathVariable String restaurantId) {
        List<Order> orders = orderService.getRestaurantOrders(restaurantId);
        return ResponseEntity.ok(Map.of(
            "success", true,
            "count",   orders.size(),
            "data",    orders
        ));
    }

    // ── Update Order Status ───────────────────────────
    // PUT /api/orders/{id}/status
    @PutMapping("/{id}/status")
    public ResponseEntity<?> updateStatus(
            @PathVariable Long id,
            @RequestBody OrderStatusUpdate update) {
        try {
            Order order = orderService.updateStatus(id, update);
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Order status updated to " + order.getStatus(),
                "data",    order
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    // ── Cancel Order ──────────────────────────────────
    // POST /api/orders/{id}/cancel
    @PostMapping("/{id}/cancel")
    public ResponseEntity<?> cancelOrder(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        try {
            String reason = body.getOrDefault("reason", "Cancelled by user");
            Order order = orderService.cancelOrder(id, reason);

            String message = "Order cancelled";
            if (order.getPenaltyApplied()) {
                message += ". Penalty of ₹" + order.getPenaltyAmount() + " applied (late cancellation)";
            }

            return ResponseEntity.ok(Map.of(
                "success",         true,
                "message",         message,
                "penalty_applied", order.getPenaltyApplied(),
                "penalty_amount",  order.getPenaltyAmount(),
                "data",            order
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "message", e.getMessage()
            ));
        }
    }

    // ── Health Check ──────────────────────────────────
    @GetMapping("/health")
    public ResponseEntity<?> health() {
        return ResponseEntity.ok(Map.of(
            "success", true,
            "service", "order-service",
            "status",  "running",
            "port",    8002
        ));
    }
}