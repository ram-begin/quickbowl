package com.quickbowl.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "orders")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String restaurantId;

    @Column(nullable = false)
    private String restaurantName;

    @Column(nullable = false)
    private String restaurantCity;

    // ORDER ITEMS stored as JSON string
    @Column(columnDefinition = "TEXT")
    private String items; // JSON array of items

    // PRICING
    private Double subtotal;
    private Double surgeMultiplier;
    private Double surgeAmount;
    private Double discountPercent;
    private Double discountAmount;
    private Double deliveryFee;
    private Double totalAmount;

    // STATUS
    // PENDING → CONFIRMED → PREPARING → OUT_FOR_DELIVERY → DELIVERED
    // PENDING → CANCELLED
    @Column(nullable = false)
    private String status = "PENDING";

    // SCHEDULED ORDER
    private Boolean isScheduled = false;
    private LocalDateTime scheduledFor; // when to deliver

    // CANCELLATION
    private String cancellationReason;
    private LocalDateTime cancelledAt;
    private Boolean penaltyApplied = false;
    private Double penaltyAmount = 0.0;

    // DELIVERY
    private String deliveryAddress;
    private String deliveryPhone;
    private LocalDateTime estimatedDelivery;
    private LocalDateTime deliveredAt;
    private Integer actualDeliveryMinutes;

    // DISCOUNT
    private Boolean discountUsed = false;

    // PAYMENT
    private String paymentStatus = "PENDING"; // PENDING, PAID, REFUNDED
    private String paymentId;

    // TIMESTAMPS
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}