package com.manpower.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

// Implementation of the EmailService for sending simple text emails
@Service
public class EmailServiceImpl implements EmailService {

    @Autowired
    private JavaMailSender mailSender; // Spring's mail sender

    /**
     * Sends a simple text email.
     *
     * @param to The recipient's email address.
     * @param subject The subject of the email.
     * @param text The body of the email.
     */
    @Override
    public void sendSimpleEmail(String to, String subject, String text) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setSubject(subject);
            message.setText(text);
            // You might want to set a 'from' address here, e.g., message.setFrom("your_email@example.com");

            mailSender.send(message);
            System.out.println("Email sent successfully to: " + to);
        } catch (MailException e) {
            System.err.println("Error sending email to " + to + ": " + e.getMessage());
            // In a production environment, you might log this error more formally
            // and potentially retry or alert an administrator.
            throw new RuntimeException("Failed to send email: " + e.getMessage(), e);
        }
    }
}
