package com.quickbowl.orderservice.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class OrderEventProducer {

    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    public void publishOrderPlaced(Map<String, Object> payload) {
        publish("order.placed", payload);
    }

    public void publishOrderStatusUpdated(Map<String, Object> payload) {
        publish("order.status.updated", payload);
    }

    private void publish(String topic, Map<String, Object> payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            kafkaTemplate.send(topic, json);
            System.out.println("📤 Published to " + topic);
        } catch (Exception e) {
            System.err.println("❌ Failed to publish to " + topic + ": " + e.getMessage());
        }
    }
}