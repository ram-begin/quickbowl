package com.quickbowl.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class OrderRequest {

    private String userId;
    private String restaurantId;
    private String restaurantName;
    private String restaurantCity;

    private List<OrderItemDto> items;

    private String deliveryAddress;
    private String deliveryPhone;

    // Scheduled order
    private Boolean isScheduled = false;
    private LocalDateTime scheduledFor;

    // Discount
    private Boolean useDiscount = false;
    private Double discountPercent = 0.0;
    private String discountType;

    // Total from frontend (trusted, already has discounts applied)
    private Double totalAmount;

    // Payment
    private String paymentMethod;
}