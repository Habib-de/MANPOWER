package com.manpower.controller;

import com.manpower.dto.LoginRequest;
import com.manpower.dto.LoginResponse;
import com.manpower.dto.ForgotPasswordRequest; // NEW: Import ForgotPasswordRequest DTO
import com.manpower.entity.Member;
import com.manpower.repository.MemberRepository;
import com.manpower.service.MemberService; // NEW: Import MemberService
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid; // For @Valid annotation on request bodies
import java.util.Optional;


@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*") // Allows frontend to connect from other ports (e.g. Expo)
public class AuthController {

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private MemberService memberService; // NEW: Autowire MemberService

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        Optional<Member> memberOpt = memberRepository.findByEmail(request.getEmail());

        if (!memberOpt.isPresent()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found");
        }

        Member member = memberOpt.get();

        if (!member.getPassword().equals(request.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Invalid password");
        }

        // --- NEW: Populate all fields in LoginResponse ---
        String groupId = null;
        if (member.getGroup() != null) { // Check if member is associated with a group
            groupId = member.getGroup().getId();
        }

        LoginResponse response = new LoginResponse(
                member.getId().toString(),
                member.getFirstName(),
                member.getLastName(),
                member.getEmail(),
                member.getRole().name(),
                member.getStatus().name(),
                member.getMansoftTenantId(),
                groupId,
                member.getPhoneNumber(),
                member.getJoinDate(),
                member.getCreatedBy(),
                member.getModifiedBy(),
                member.getCreatedOn(),
                member.getModifiedOn()
        );

        return ResponseEntity.ok(response);
    }

    /**
     * Handles the forgot password request.
     * Receives an email, triggers password reset in MemberService,
     * and sends a new temporary password to the user's email.
     *
     * @param request ForgotPasswordRequest DTO containing the user's email.
     * @return ResponseEntity indicating success or failure.
     */
    @PostMapping("/forgot-password") // NEW: Endpoint for forgot password
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        try {
            String message = memberService.resetPassword(request.getEmail());
            return ResponseEntity.ok(message); // Return success message
        } catch (IllegalArgumentException e) {
            // Member not found or invalid email
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        } catch (RuntimeException e) {
            // Other errors during password reset or email sending
            System.err.println("Error during password reset for email " + request.getEmail() + ": " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("Failed to reset password. Please try again later.");
        }
    }
}
