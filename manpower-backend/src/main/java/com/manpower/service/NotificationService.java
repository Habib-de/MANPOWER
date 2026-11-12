package com.manpower.service;

import com.manpower.entity.Member;
import com.manpower.entity.Notification;
import com.manpower.repository.MemberRepository;
import com.manpower.repository.NotificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.Set; // Import for Set
import java.util.UUID;
// import java.util.stream.Collectors; // Import for stream operations

@Service
public class NotificationService {

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private MemberRepository memberRepository; // Assuming this repository exists for Member entity

    public List<Notification> getAllNotifications() {
        return notificationRepository.findAll();
    }

    public Optional<Notification> getNotificationById(String id) {
        return notificationRepository.findById(id);
    }

    public Notification saveNotification(Notification notification) {
        // When saving (either creating or updating), ensure timestamps are managed.
        // For new notifications, createdOn and modifiedOn are set by entity.
        // For updates, you might want to explicitly set modifiedOn here if not handled by @PreUpdate
        if (notification.getCreatedOn() == null) {
            notification.setCreatedOn(new Date());
        }
        notification.setModifiedOn(new Date());
        return notificationRepository.save(notification);
    }

    public void deleteNotification(String id) {
        notificationRepository.deleteById(id);
    }

    /**
     * Sends a notification to all members in a specified group.
     * New notifications are initialized as unread.
     * @param groupId The ID of the group whose members will receive the notification.
     * @param template A Notification object containing the common details for the notifications.
     */
    public void sendToGroupMembers(String groupId, Notification template) {
        List<Member> members = memberRepository.findByGroupId(groupId); // Assuming findByGroupId method exists

        for (Member member : members) {
            Notification notif = new Notification();
            notif.setId(UUID.randomUUID().toString());
            notif.setMember(member);
            notif.setType(template.getType());
            notif.setMessageContent(template.getMessageContent());
            notif.setSendDate(template.getSendDate());
            notif.setChannel(template.getChannel());
            notif.setCreatedBy(template.getCreatedBy());
            notif.setModifiedBy(template.getModifiedBy());
            notif.setCreatedOn(new Date()); // Set creation timestamp
            notif.setModifiedOn(new Date()); // Set modification timestamp
            notif.setMansoftTenantId(template.getMansoftTenantId());
            notif.setRead(false); // ✅ IMPORTANT: Set new notifications as unread by default

            notificationRepository.save(notif);
        }
    }

    /**
     * Marks a single notification as read.
     * @param notificationId The ID of the notification to mark as read.
     * @return An Optional containing the updated Notification object if found,
     * or an empty Optional if the notification does not exist.
     */
    public Optional<Notification> markNotificationAsRead(String notificationId) {
        return notificationRepository.findById(notificationId).map(notification -> {
            notification.setRead(true); // Mark as read
            notification.setModifiedOn(new Date()); // Update modified timestamp
            return notificationRepository.save(notification); // Save the updated notification
        });
    }

    /**
     * Marks multiple notifications as read in a single batch operation.
     * @param notificationIds A Set of notification IDs to mark as read.
     * @return A List of the updated Notification objects.
     */
    public List<Notification> markNotificationsAsRead(Set<String> notificationIds) {
        // Fetch all notifications by their IDs
        List<Notification> notificationsToUpdate = notificationRepository.findAllById(notificationIds);

        // Update the 'isRead' status and 'modifiedOn' timestamp for each
        notificationsToUpdate.forEach(notification -> {
            notification.setRead(true);
            notification.setModifiedOn(new Date());
        });

        // Save all updated notifications in a batch
        return notificationRepository.saveAll(notificationsToUpdate);
    }
}