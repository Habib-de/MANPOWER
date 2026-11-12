package com.manpower.service;

// Interface for email sending operations
public interface EmailService {
    void sendSimpleEmail(String to, String subject, String text);
    // You might add methods for HTML emails, emails with attachments later
}
