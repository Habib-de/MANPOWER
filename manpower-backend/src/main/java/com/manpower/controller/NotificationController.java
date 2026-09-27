package com.manpower.controller;

import com.manpower.entity.Notification;
import com.manpower.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content; // Import for Swagger @Content
import io.swagger.v3.oas.annotations.media.Schema; // Import for Swagger @Schema
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus; // Import for HttpStatus
import org.springframework.http.ResponseEntity; // Import for ResponseEntity
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;
import java.util.Set; // Import for Set
import java.util.UUID;

@CrossOrigin(origins = {"http://localhost:8081", "http://192.168.0.101:8081"})
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @Operation(summary = "Create a notification")
    @ApiResponse(responseCode = "200", description = "Notification created")
    @PostMapping
    public Notification create(@RequestBody Notification notification) {
        if (notification.getId() == null || notification.getId().trim().isEmpty()) {
            notification.setId(UUID.randomUUID().toString());
        }
        notification.setRead(false); // ✅ IMPORTANT: New notifications are unread by default
        return notificationService.saveNotification(notification);
    }

    @Operation(summary = "Get all notifications")
    @GetMapping
    public List<Notification> getAll() {
        return notificationService.getAllNotifications();
    }

    @Operation(summary = "Get notification by ID")
    @GetMapping("/{id}")
    public Optional<Notification> getById(@PathVariable String id) {
        return notificationService.getNotificationById(id);
    }

    @Operation(summary = "Update a notification")
    @PutMapping("/{id}")
    public Notification update(@PathVariable String id, @RequestBody Notification notification) {
        notification.setId(id);
        return notificationService.saveNotification(notification);
    }

    @Operation(summary = "Delete a notification")
    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        notificationService.deleteNotification(id);
    }

    @Operation(summary = "Send notification to all members in a group")
    @ApiResponse(responseCode = "200", description = "Notifications sent successfully")
    @PostMapping("/send-to-group/{groupId}")
    public String sendToGroupMembers(
            @PathVariable String groupId,
            @RequestBody Notification template
    ) {
        notificationService.sendToGroupMembers(groupId, template);
        return "Notifications sent to all group members successfully.";
    }

    // --- NEW ENDPOINTS FOR MARKING AS READ ---

    @Operation(summary = "Mark a single notification as read")
    @ApiResponse(responseCode = "200", description = "Notification marked as read",
            content = @Content(mediaType = "application/json",
                    schema = @Schema(implementation = Notification.class)))
    @ApiResponse(responseCode = "404", description = "Notification not found")
    @PatchMapping("/{id}/mark-as-read") // Using PATCH for partial update
    public ResponseEntity<Notification> markAsRead(@PathVariable String id) {
        Optional<Notification> updatedNotification = notificationService.markNotificationAsRead(id);
        return updatedNotification.map(ResponseEntity::ok) // Returns 200 OK with the updated notification
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND).build()); // Returns 404 Not Found
    }

    @Operation(summary = "Mark multiple notifications as read")
    @ApiResponse(responseCode = "200", description = "Notifications marked as read",
            content = @Content(mediaType = "application/json",
                    schema = @Schema(implementation = Notification.class)))
    @PatchMapping("/mark-many-as-read")
    public ResponseEntity<List<Notification>> markManyAsRead(@RequestBody Set<String> notificationIds) {
        if (notificationIds == null || notificationIds.isEmpty()) {
            return ResponseEntity.badRequest().build(); // Return 400 Bad Request if no IDs are provided
        }
        List<Notification> updatedNotifications = notificationService.markNotificationsAsRead(notificationIds);
        return ResponseEntity.ok(updatedNotifications); // Returns 200 OK with the list of updated notifications
    }
}