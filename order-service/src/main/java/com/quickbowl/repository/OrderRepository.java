package com.quickbowl.repository;

import com.quickbowl.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    // Get all orders by user
    List<Order> findByUserIdOrderByCreatedAtDesc(String userId);

    // Get all orders by restaurant
    List<Order> findByRestaurantIdOrderByCreatedAtDesc(String restaurantId);

    // Get orders by status
    List<Order> findByStatus(String status);

    // Get scheduled orders due for processing
    List<Order> findByIsScheduledTrueAndStatusAndScheduledForBefore(
        String status, LocalDateTime time
    );

    // Get orders by user and status
    List<Order> findByUserIdAndStatus(String userId, String status);

    // Count today's orders for a restaurant
    @Query("SELECT COUNT(o) FROM Order o WHERE o.restaurantId = :restaurantId " +
           "AND o.createdAt >= :startOfDay AND o.status = 'DELIVERED'")
    Long countTodayDeliveredOrders(String restaurantId, LocalDateTime startOfDay);

    // Revenue for restaurant
    @Query("SELECT SUM(o.totalAmount) FROM Order o WHERE o.restaurantId = :restaurantId " +
           "AND o.status = 'DELIVERED'")
    Double getTotalRevenueByRestaurant(String restaurantId);
}