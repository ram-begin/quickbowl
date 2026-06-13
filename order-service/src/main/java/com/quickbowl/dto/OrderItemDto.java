package com.quickbowl.dto;

import lombok.Data;

@Data
public class OrderItemDto {
    private String itemId;
    private String name;
    private Integer quantity;
    private Double price;
    private String category;
}