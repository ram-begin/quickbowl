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
}