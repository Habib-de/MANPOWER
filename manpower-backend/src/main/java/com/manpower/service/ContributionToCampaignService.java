package com.manpower.service;

import com.manpower.dto.ContributionToCampaignRequest;
import com.manpower.dto.CampaignContributionResponse;
import com.manpower.entity.*;
import com.manpower.enums.TransactionType;
import com.manpower.enums.TransactionStatus;
import com.manpower.enums.CampaignStatus;
import com.manpower.enums.MemberRole;
import com.manpower.enums.MemberStatus;
import com.manpower.repository.*;
import lombok.RequiredArgsConstructor;
import org.json.JSONObject;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ContributionToCampaignService {

    private final VolunteerCampaignRepository campaignRepository;
    private final ContributionRepository contributionRepository;
    private final MemberRepository memberRepository;
    private final GroupRepository groupRepository;
    private final MpesaService mpesaService;

    // Cache for storing contribution data before payment completion
    private final Map<String, PendingContribution> pendingContributions = new HashMap<>();

    /**
     * CREATE PENDING CONTRIBUTION - Called from PaymentController
     * This creates the pending entry BEFORE STK push is sent
     */
    @Transactional
    public void createPendingContribution(
            String contributionId,
            String campaignId,
            String memberId,
            String groupId,
            BigDecimal amount,
            String phoneNumber,
            String description,
            String tenantId) {
        
        try {
            // 1. Get campaign
            VolunteerCampaign campaign = campaignRepository.findById(campaignId)
                .orElseThrow(() -> new RuntimeException("Campaign not found: " + campaignId));
            
            // 2. Get member
            Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found: " + memberId));
            
            // 3. Get group
            Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group not found: " + groupId));
            
            // 4. Create pending contribution
            PendingContribution pending = new PendingContribution();
            pending.setContributionId(contributionId);
            pending.setCampaign(campaign);
            pending.setMember(member);
            pending.setGroup(group);
            pending.setAmount(amount);
            pending.setPhoneNumber(phoneNumber);
            pending.setDescription(description);
            pending.setTenantId(tenantId);
            pending.setCreatedAt(LocalDateTime.now());
            
            // 5. Store in cache
            pendingContributions.put(contributionId, pending);
            
            // 6. Schedule cleanup
            scheduleCleanup(contributionId);
            
            System.out.println("\n✅✅✅ ===== PENDING CONTRIBUTION CREATED =====");
            System.out.println("   Contribution ID: " + contributionId);
            System.out.println("   Campaign: " + campaign.getCampaignName());
            System.out.println("   Member: " + member.getFirstName() + " " + member.getLastName());
            System.out.println("   Amount: KES " + amount);
            System.out.println("✅✅✅ ========================================\n");
            
        } catch (Exception e) {
            System.err.println("\n❌❌❌ ===== FAILED TO CREATE PENDING CONTRIBUTION =====");
            System.err.println("   Contribution ID: " + contributionId);
            System.err.println("   Error: " + e.getMessage());
            System.err.println("❌❌❌ ================================================\n");
            throw new RuntimeException("Failed to create pending contribution: " + e.getMessage(), e);
        }
    }

    /**
     * Process a contribution to a volunteer campaign
     * This is the OLD method - kept for backward compatibility
     * But we're now using createPendingContribution + completeContribution flow
     */
    @Transactional
    public CampaignContributionResponse processContribution(
            ContributionToCampaignRequest request,
            String memberId,
            String groupId,
            String tenantId) {

        // 1. Validate campaign exists and is open
        VolunteerCampaign campaign = campaignRepository.findById(request.getCampaignId())
                .orElseThrow(() -> new RuntimeException("Campaign not found with ID: " + request.getCampaignId()));

        // 2. Check if campaign belongs to the member's group
        if (!campaign.getGroup().getId().equals(groupId)) {
            throw new RuntimeException("Campaign does not belong to your group");
        }

        // 3. Check if campaign is open for contributions
        LocalDate today = LocalDate.now();
        if (campaign.getStatus() != CampaignStatus.ACTIVE) {
            throw new RuntimeException("Campaign is not active. Current status: " + campaign.getStatus());
        }
        if (today.isBefore(campaign.getStartDate())) {
            throw new RuntimeException("Campaign has not started yet. Starts on: " + campaign.getStartDate());
        }
        if (today.isAfter(campaign.getEndDate())) {
            throw new RuntimeException("Campaign has ended on: " + campaign.getEndDate());
        }

        // 4. Get member and group
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found with ID: " + memberId));
        
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new RuntimeException("Group not found with ID: " + groupId));

        // 5. Generate a unique contribution ID for tracking
        String contributionId = "VOL-" + campaign.getId().substring(0, 8) + "-" + System.currentTimeMillis();

        // 6. Prepare MPESA payment
        String phoneNumber = formatPhoneNumber(request.getPhoneNumber());
        String accountReference = campaign.getCampaignName().length() > 12 
            ? campaign.getCampaignName().substring(0, 12) 
            : campaign.getCampaignName();
        
        String transactionDesc = String.format("VOL:%s-%s", 
            campaign.getCampaignName().replace(" ", ""), 
            member.getFirstName());

        try {
            // 7. Initiate STK Push
            JSONObject mpesaResponse = mpesaService.sendStkPush(
                groupId,
                phoneNumber,
                request.getAmount().intValue(),
                accountReference,
                transactionDesc,
                contributionId  // Pass contribution ID for callback
            );

            // 8. Check if MPESA request was successful
            if (mpesaResponse.has("error")) {
                throw new RuntimeException("MPESA payment failed: " + mpesaResponse.getString("error"));
            }

            // 9. Store pending contribution in cache
            PendingContribution pending = new PendingContribution();
            pending.setContributionId(contributionId);
            pending.setCampaign(campaign);
            pending.setMember(member);
            pending.setGroup(group);
            pending.setAmount(request.getAmount());
            pending.setPhoneNumber(phoneNumber);
            pending.setDescription(request.getDescription());
            pending.setTenantId(tenantId);
            pending.setMpesaRequestId(mpesaResponse.optString("MerchantRequestID"));
            pending.setCheckoutRequestId(mpesaResponse.optString("CheckoutRequestID"));
            pending.setCreatedAt(LocalDateTime.now());

            pendingContributions.put(contributionId, pending);

            // 10. Schedule cleanup after 30 minutes (to prevent memory leaks)
            scheduleCleanup(contributionId);

            // 11. Build response
            return CampaignContributionResponse.builder()
                    .contributionId(contributionId)
                    .campaignId(campaign.getId())
                    .campaignName(campaign.getCampaignName())
                    .memberId(member.getId())
                    .memberName(member.getFirstName() + " " + member.getLastName())
                    .amount(request.getAmount())
                    .contributionDate(LocalDateTime.now())
                    .status("PENDING")
                    .transactionId(mpesaResponse.optString("CheckoutRequestID"))
                    .build();

        } catch (Exception e) {
            throw new RuntimeException("Failed to initiate payment: " + e.getMessage(), e);
        }
    }

    /**
     * Complete contribution after successful MPESA callback
     * Called from PaymentCallbackController
     */
    @Transactional
    public CampaignContributionResponse completeContribution(String contributionId, String mpesaReceiptNumber) {
        // 1. Get pending contribution from cache
        PendingContribution pending = pendingContributions.remove(contributionId);
        if (pending == null) {
            throw new RuntimeException("Pending contribution not found for ID: " + contributionId);
        }

        // 2. Create and save contribution
        Contribution contribution = new Contribution();
        contribution.setMember(pending.getMember());
        contribution.setGroup(pending.getGroup());
        contribution.setVolunteerCampaign(pending.getCampaign()); // Link to campaign
        contribution.setTransactionType(TransactionType.volunteer);
        contribution.setAmount(pending.getAmount());
        contribution.setTransactionDate(LocalDate.now());
        contribution.setPaymentMethod("MPESA");
        contribution.setStatus(TransactionStatus.Completed);
        
        // Build description with campaign info
        String description = String.format("Volunteer: %s | %s | Receipt: %s",
            pending.getCampaign().getCampaignName(),
            pending.getDescription() != null ? pending.getDescription() : "Campaign contribution",
            mpesaReceiptNumber != null ? mpesaReceiptNumber : "N/A");
        contribution.setDescription(description);
        
        contribution.setCreatedBy(pending.getMember().getId());
        contribution.setModifiedBy(pending.getMember().getId());
        contribution.setMansoftTenantId(pending.getTenantId());

        Contribution saved = contributionRepository.save(contribution);

        // 3. Update campaign's raised amount
        VolunteerCampaign campaign = pending.getCampaign();
        BigDecimal newRaisedAmount = campaign.getRaisedAmount().add(pending.getAmount());
        campaign.setRaisedAmount(newRaisedAmount);
        
        // 4. Check if campaign reached target amount
        if (campaign.getTargetAmount() != null && 
            newRaisedAmount.compareTo(campaign.getTargetAmount()) >= 0) {
            campaign.setStatus(CampaignStatus.COMPLETED);
        }
        
        campaignRepository.save(campaign);

        // 5. Build response
        return CampaignContributionResponse.builder()
                .contributionId(saved.getId())
                .campaignId(campaign.getId())
                .campaignName(campaign.getCampaignName())
                .memberId(pending.getMember().getId())
                .memberName(pending.getMember().getFirstName() + " " + pending.getMember().getLastName())
                .amount(pending.getAmount())
                .contributionDate(LocalDateTime.now())
                .status("COMPLETED")
                .transactionId(mpesaReceiptNumber)
                .build();
    }

    /**
     * Get all contributions for a specific campaign
     */
    @Transactional(readOnly = true)
    public List<CampaignContributionResponse> getCampaignContributions(String campaignId) {
        // Verify campaign exists
        VolunteerCampaign campaign = campaignRepository.findById(campaignId)
                .orElseThrow(() -> new RuntimeException("Campaign not found with ID: " + campaignId));

        // Get all contributions linked to this campaign
        List<Contribution> contributions = contributionRepository.findByVolunteerCampaignId(campaignId);

        return contributions.stream()
                .map(c -> CampaignContributionResponse.builder()
                        .contributionId(c.getId())
                        .campaignId(campaignId)
                        .campaignName(campaign.getCampaignName())
                        .memberId(c.getMember().getId())
                        .memberName(c.getMember().getFirstName() + " " + c.getMember().getLastName())
                        .amount(c.getAmount())
                        .contributionDate(c.getCreatedOn())
                        .status(c.getStatus().name())
                        .transactionId(c.getDescription() != null ? 
                            extractReceiptNumber(c.getDescription()) : null)
                        .build())
                .sorted((a, b) -> b.getContributionDate().compareTo(a.getContributionDate()))
                .collect(Collectors.toList());
    }

    /**
     * Get member's volunteer contributions
     */
    @Transactional(readOnly = true)
    public List<CampaignContributionResponse> getMemberVolunteerContributions(String memberId) {
        List<Contribution> contributions = contributionRepository
            .findByMemberIdAndTransactionType(memberId, TransactionType.volunteer);

        return contributions.stream()
                .filter(c -> c.getVolunteerCampaign() != null)
                .map(c -> CampaignContributionResponse.builder()
                        .contributionId(c.getId())
                        .campaignId(c.getVolunteerCampaign().getId())
                        .campaignName(c.getVolunteerCampaign().getCampaignName())
                        .memberId(c.getMember().getId())
                        .memberName(c.getMember().getFirstName() + " " + c.getMember().getLastName())
                        .amount(c.getAmount())
                        .contributionDate(c.getCreatedOn())
                        .status(c.getStatus().name())
                        .transactionId(extractReceiptNumber(c.getDescription()))
                        .build())
                .sorted((a, b) -> b.getContributionDate().compareTo(a.getContributionDate()))
                .collect(Collectors.toList());
    }

        /**
     * Process a cash contribution to a volunteer campaign (Admin records on behalf of member)
     */
    @Transactional
    public CampaignContributionResponse processCashContribution(
            String campaignId,
            String memberId,
            String groupId,
            BigDecimal amount,
            String description,
            String adminId,
            String tenantId) {

        // 1. Validate campaign exists and is open
        VolunteerCampaign campaign = campaignRepository.findById(campaignId)
                .orElseThrow(() -> new RuntimeException("Campaign not found with ID: " + campaignId));

        // 2. Check if campaign belongs to the group
        if (!campaign.getGroup().getId().equals(groupId)) {
            throw new RuntimeException("Campaign does not belong to your group");
        }

        // 3. Check if campaign is open for contributions
        LocalDate today = LocalDate.now();
        if (campaign.getStatus() != CampaignStatus.ACTIVE) {
            throw new RuntimeException("Campaign is not active. Current status: " + campaign.getStatus());
        }
        if (today.isBefore(campaign.getStartDate())) {
            throw new RuntimeException("Campaign has not started yet. Starts on: " + campaign.getStartDate());
        }
        if (today.isAfter(campaign.getEndDate())) {
            throw new RuntimeException("Campaign has ended on: " + campaign.getEndDate());
        }

        // 4. Get member and admin
        Member member = memberRepository.findById(memberId)
                .orElseThrow(() -> new RuntimeException("Member not found with ID: " + memberId));
        
        Member admin = memberRepository.findById(adminId)
                .orElseThrow(() -> new RuntimeException("Admin not found with ID: " + adminId));

        // 5. Validate member is active
        if (member.getStatus() != MemberStatus.Active) {
            throw new RuntimeException("Member is not active. Current status: " + member.getStatus());
        }

        // 6. Validate admin has permission (GroupAdmin or SuperAdmin)
        if (admin.getRole() != MemberRole.GroupAdmin && admin.getRole() != MemberRole.SuperAdmin) {
            throw new RuntimeException("Only GroupAdmin or SuperAdmin can record cash contributions");
        }

        // 7. Validate amount
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new RuntimeException("Amount must be greater than zero");
        }

        // 8. Create and save contribution
        Contribution contribution = new Contribution();
        contribution.setMember(member);
        contribution.setGroup(campaign.getGroup());
        contribution.setVolunteerCampaign(campaign);
        contribution.setTransactionType(TransactionType.volunteer);
        contribution.setAmount(amount);
        contribution.setTransactionDate(LocalDate.now());
        contribution.setPaymentMethod("Cash");
        contribution.setStatus(TransactionStatus.Completed);
        
        // Build description
        String fullDescription = String.format("Volunteer: %s | Cash payment recorded by %s %s",
            campaign.getCampaignName(),
            admin.getFirstName(),
            admin.getLastName());
        if (description != null && !description.isEmpty()) {
            fullDescription += " | " + description;
        }
        contribution.setDescription(fullDescription);
        
        contribution.setCreatedBy(adminId);
        contribution.setModifiedBy(adminId);
        contribution.setMansoftTenantId(tenantId);

        Contribution saved = contributionRepository.save(contribution);

        // 9. Update campaign's raised amount
        BigDecimal newRaisedAmount = campaign.getRaisedAmount().add(amount);
        campaign.setRaisedAmount(newRaisedAmount);
        
        // 10. Check if campaign reached target amount
        if (campaign.getTargetAmount() != null && 
            newRaisedAmount.compareTo(campaign.getTargetAmount()) >= 0) {
            campaign.setStatus(CampaignStatus.COMPLETED);
        }
        
        campaignRepository.save(campaign);

        // 11. Build response
        return CampaignContributionResponse.builder()
                .contributionId(saved.getId())
                .campaignId(campaign.getId())
                .campaignName(campaign.getCampaignName())
                .memberId(member.getId())
                .memberName(member.getFirstName() + " " + member.getLastName())
                .amount(amount)
                .contributionDate(LocalDateTime.now())
                .status("COMPLETED")
                .transactionId("CASH-" + System.currentTimeMillis())
                .build();
    }

    /**
     * Get all active members in a group for volunteer contributions
     */
    @Transactional(readOnly = true)
    public List<Member> getGroupMembersForVolunteer(String groupId) {
        return memberRepository.findByGroupIdAndStatus(groupId, MemberStatus.Active);
    }

    /**
     * Handle failed payment from MPESA callback
     */
    @Transactional
    public void handleFailedPayment(String contributionId, String failureReason) {
        PendingContribution pending = pendingContributions.remove(contributionId);
        if (pending != null) {
            System.out.println("Payment failed for contribution: " + contributionId + 
                             " Reason: " + failureReason);
            // Log failed payment but don't create contribution record
        }
    }

    // ==================== HELPER METHODS ====================

    private String formatPhoneNumber(String phone) {
        phone = phone.trim();
        if (phone.startsWith("0")) {
            return "254" + phone.substring(1);
        } else if (phone.startsWith("+")) {
            return phone.substring(1);
        } else if (phone.startsWith("7")) {
            return "254" + phone;
        }
        return phone;
    }

    private String extractReceiptNumber(String description) {
        if (description == null) return null;
        int receiptIndex = description.indexOf("Receipt:");
        if (receiptIndex != -1) {
            return description.substring(receiptIndex + 8).trim();
        }
        return null;
    }

    private void scheduleCleanup(String contributionId) {
        // Simple cleanup after 30 minutes
        new Thread(() -> {
            try {
                Thread.sleep(30 * 60 * 1000); // 30 minutes
                PendingContribution removed = pendingContributions.remove(contributionId);
                if (removed != null) {
                    System.out.println("Cleaned up expired pending contribution: " + contributionId);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }).start();
    }

    // ==================== INNER CLASS ====================
    
    private static class PendingContribution {
        private String contributionId;
        private VolunteerCampaign campaign;
        private Member member;
        private Group group;
        private BigDecimal amount;
        private String phoneNumber;
        private String description;
        private String tenantId;
        private String mpesaRequestId;
        private String checkoutRequestId;
        private LocalDateTime createdAt;

        // Getters and setters - keep only the ones that are used
        public String getContributionId() { return contributionId; }
        public void setContributionId(String contributionId) { this.contributionId = contributionId; }

        public VolunteerCampaign getCampaign() { return campaign; }
        public void setCampaign(VolunteerCampaign campaign) { this.campaign = campaign; }

        public Member getMember() { return member; }
        public void setMember(Member member) { this.member = member; }

        public Group getGroup() { return group; }
        public void setGroup(Group group) { this.group = group; }

        public BigDecimal getAmount() { return amount; }
        public void setAmount(BigDecimal amount) { this.amount = amount; }

        public String getPhoneNumber() { return phoneNumber; }
        public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public String getTenantId() { return tenantId; }
        public void setTenantId(String tenantId) { this.tenantId = tenantId; }

        public String getMpesaRequestId() { return mpesaRequestId; }
        public void setMpesaRequestId(String mpesaRequestId) { this.mpesaRequestId = mpesaRequestId; }

        public String getCheckoutRequestId() { return checkoutRequestId; }
        public void setCheckoutRequestId(String checkoutRequestId) { this.checkoutRequestId = checkoutRequestId; }

        public LocalDateTime getCreatedAt() { return createdAt; }
        public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    }
}