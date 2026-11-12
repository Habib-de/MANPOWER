package com.manpower.service;

import com.manpower.entity.Member;
import com.manpower.enums.MemberRole;
import com.manpower.repository.MemberRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime; // Import for LocalDateTime
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class MemberServiceImpl implements MemberService {

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private EmailService emailService;

    @Override
    @Transactional
    public Member saveMember(Member member) {
        if (member.getRole() == MemberRole.SuperAdmin && memberRepository.findByRole(MemberRole.SuperAdmin).isPresent()) {
            throw new RuntimeException("SuperAdmin already exists. Only one SuperAdmin is allowed.");
        }
        // Set creation/modification timestamps and tenant ID upon creation
        member.setCreatedOn(LocalDateTime.now());
        member.setModifiedOn(LocalDateTime.now());
        // You might want to set createdBy and modifiedBy based on current authenticated user
        // For now, assuming they come from the request or are set by default in entity/DB
        // member.setMansoftTenantId("tenant-001"); // This might be dynamically set based on context

        return memberRepository.save(member);
    }

    @Override
    public List<Member> getAllMembers() {
        return memberRepository.findAll();
    }

    @Override
    public Optional<Member> getMemberById(String id) {
        return memberRepository.findById(id);
    }

    @Override
    @Transactional
    public Member updateMember(String id, Member memberDetails) {
        Optional<Member> memberOpt = memberRepository.findById(id);
        if (!memberOpt.isPresent()) {
            throw new IllegalArgumentException("Member with ID " + id + " not found.");
        }

        Member existingMember = memberOpt.get();

        // Update basic fields
        existingMember.setFirstName(memberDetails.getFirstName());
        existingMember.setLastName(memberDetails.getLastName());
        existingMember.setEmail(memberDetails.getEmail());
        existingMember.setPhoneNumber(memberDetails.getPhoneNumber());

        // --- FIX: Add this line to update the status ---
        existingMember.setStatus(memberDetails.getStatus());

        // --- Consider updating other fields if they are part of the PUT request ---
        // If 'group' is updatable:
        if (memberDetails.getGroup() != null && memberDetails.getGroup().getId() != null) {
            // This assumes group is managed separately and you're just updating the reference.
            // You might need a GroupService to fetch/validate the group if it's not just an ID reference.
            existingMember.setGroup(memberDetails.getGroup());
        }

        // If 'role' is updatable (be careful with role changes, especially for SuperAdmin)
        // existingMember.setRole(memberDetails.getRole());

        // If 'joinDate' is updatable
        // existingMember.setJoinDate(memberDetails.getJoinDate());

        // Update auditing fields
        existingMember.setModifiedOn(LocalDateTime.now()); // Set current time for modification
        // You might set modifiedBy based on the authenticated user performing the update
        // existingMember.setModifiedBy("current_authenticated_user_id"); // Or memberDetails.getModifiedBy() if sent in request

        return memberRepository.save(existingMember);
    }

    @Override
    @Transactional
    public void deleteMember(String id) {
        memberRepository.deleteById(id);
    }

    @Override
    @Transactional
    public String resetPassword(String email) {
        Optional<Member> memberOpt = memberRepository.findByEmail(email);

        if (!memberOpt.isPresent()) {
            throw new IllegalArgumentException("Member with email " + email + " not found.");
        }

        Member member = memberOpt.get();
        String newPassword = UUID.randomUUID().toString().substring(0, 8);
        member.setPassword(newPassword); // In a real app, you'd hash this password
        member.setModifiedOn(LocalDateTime.now()); // Update modified timestamp
        memberRepository.save(member);

        String subject = "Your Manpower Account Password Reset";
        String text = "Dear " + member.getFirstName() + ",\n\n"
                + "Your password has been reset. Your new temporary password is: " + newPassword + "\n"
                + "Please log in with this password and change it immediately under your profile screen for security reasons.\n\n"
                + "Thank you,\nManpower Team";

        emailService.sendSimpleEmail(member.getEmail(), subject, text);

        return "A new password has been sent to your email.";
    }

    @Override
    public List<Member> findByGroupId(String groupId) {
        return memberRepository.findByGroupId(groupId);
    }
}