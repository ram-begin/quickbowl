package com.quickbowl.dto;

import lombok.Data;

@Data
public class OrderStatusUpdate {
    private String status;
    private String reason; // for cancellation
    private Integer deliveryMinutes; // for delivered status
}