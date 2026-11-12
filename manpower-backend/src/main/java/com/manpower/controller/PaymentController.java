package com.manpower.controller;

import com.manpower.entity.Group;
import com.manpower.entity.Member;
import com.manpower.repository.MemberRepository;
import com.manpower.service.GroupService;
import com.manpower.service.MpesaService;
import com.manpower.service.ContributionToCampaignService; // 👈 ADD THIS IMPORT
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal; // 👈 ADD THIS IMPORT
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/payments")
@CrossOrigin(origins = "*")
public class PaymentController {
    
    @Autowired
    private MemberRepository memberRepository;
    
    @Autowired
    private GroupService groupService;
    
    @Autowired
    private MpesaService mpesaService;
    
    // 👇 ADD THIS AUTOWIRED DEPENDENCY
    @Autowired
    private ContributionToCampaignService contributionToCampaignService;
    
    // ========== CACHE FOR TRANSACTION TYPES ==========
    private static final long CACHE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
    private static final Map<String, CacheEntry> transactionTypeCache = new ConcurrentHashMap<>();
    
    // Cache entry with timestamp for expiration - NOW PUBLIC
    public static class CacheEntry {
        private String transactionType;
        private String groupId;
        private String memberId;
        private String campaignId;  // 👈 ADDED: Store campaignId for volunteer contributions
        private long timestamp;
        
        public CacheEntry(String transactionType, String groupId, String memberId) {
            this(transactionType, groupId, memberId, null);
        }
        
        public CacheEntry(String transactionType, String groupId, String memberId, String campaignId) {  // 👈 NEW CONSTRUCTOR
            this.transactionType = transactionType;
            this.groupId = groupId;
            this.memberId = memberId;
            this.campaignId = campaignId;
            this.timestamp = System.currentTimeMillis();
        }
        
        public boolean isExpired() {
            return System.currentTimeMillis() - timestamp > CACHE_TIMEOUT_MS;
        }
        
        // Getters
        public String getTransactionType() {
            return transactionType;
        }
        
        public String getGroupId() {
            return groupId;
        }
        
        public String getMemberId() {
            return memberId;
        }
        
        public String getCampaignId() {  // 👈 ADDED: Getter for campaignId
            return campaignId;
        }
        
        public long getTimestamp() {
            return timestamp;
        }
    }

    @PostMapping("/initiate-contribution")
    public ResponseEntity<Map<String, Object>> initiatePayment(
            @RequestParam("amount") final String amountStr,
            @RequestParam("phone") final String phone,
            @RequestParam("memberId") final String memberId,
            @RequestParam("groupId") final String groupId,
            @RequestParam(value = "transactionType", defaultValue = "Contribution") final String transactionType,
            @RequestParam(value = "contributionId", required = false) final String contributionId,
            @RequestParam(value = "campaignId", required = false) final String campaignId) {  // 👈 ADDED: Capture campaignId

        Map<String, Object> result = new HashMap<>();
        int amount = 0;

        // ========== VALIDATE GROUP EXISTS ==========
        if (groupId == null || groupId.trim().isEmpty()) {
            result.put("status", 400);
            result.put("message", "Group ID is required");
            return ResponseEntity.status(400).body(result);
        }
        
        String groupIdTrimmed = groupId.trim();
        
        // Check if group has active MPESA
        Optional<Group> groupOpt = groupService.getGroupWithActiveMpesa(groupIdTrimmed);
        if (!groupOpt.isPresent()) {
            result.put("status", 400);
            result.put("message", "Group not found or MPESA not active for group: " + groupIdTrimmed);
            return ResponseEntity.status(400).body(result);
        }
        
        Group group = groupOpt.get();
        System.out.println("✅ Found group: " + group.getGroupName() + " (ID: " + groupIdTrimmed + ")");
        System.out.println("💰 Business Shortcode: " + group.getMpesaBusinessShortcode());
        System.out.println("🔗 Callback URL: " + group.getMpesaCallbackUrl());

        // ========== VALIDATE MEMBER EXISTS ==========
        if (memberId == null || memberId.trim().isEmpty()) {
            result.put("status", 400);
            result.put("message", "Member ID is required");
            return ResponseEntity.status(400).body(result);
        }

        String memberIdTrimmed = memberId.trim();
        
        // Check if member exists in database AND belongs to this group
        Optional<Member> memberOpt = memberRepository.findById(memberIdTrimmed);
        if (!memberOpt.isPresent()) {
            result.put("status", 404);
            result.put("message", "Member not found with ID: " + memberIdTrimmed);
            return ResponseEntity.status(404).body(result);
        }

        Member member = memberOpt.get();
        
        // Verify member belongs to the specified group
        if (member.getGroup() == null || !member.getGroup().getId().equals(groupIdTrimmed)) {
            result.put("status", 400);
            result.put("message", "Member does not belong to the specified group");
            return ResponseEntity.status(400).body(result);
        }
        
        System.out.println("✅ Found member: " + member.getFirstName() + " " + 
                          member.getLastName() + " (ID: " + memberIdTrimmed + ")");
        System.out.println("📞 Registered phone: " + member.getPhoneNumber());
        // ========== END VALIDATION ==========

        // Validate amount
        try {
            amount = Integer.parseInt(amountStr);
            if (amount < 1) {
                result.put("status", 400);
                result.put("message", "Amount must be at least 1 KES.");
                return ResponseEntity.status(400).body(result);
            }
        } catch (NumberFormatException e) {
            result.put("status", 400);
            result.put("message", "Invalid amount format. Inputed Amount: " + amountStr);
            return ResponseEntity.status(400).body(result);
        }

        // Use member's phone if none provided, otherwise use provided phone
        String customerPhone;
        if (phone != null && !phone.isEmpty()) {
            customerPhone = phone;
        } else if (member.getPhoneNumber() != null && !member.getPhoneNumber().isEmpty()) {
            customerPhone = member.getPhoneNumber();
        } else {
            customerPhone = "254703262817"; // Default fallback
        }
        
        // Format phone number (ensure it starts with 254)
        if (!customerPhone.startsWith("254")) {
            if (customerPhone.startsWith("0")) {
                customerPhone = "254" + customerPhone.substring(1);
            } else if (customerPhone.startsWith("+254")) {
                customerPhone = customerPhone.substring(1);
            }
        }

        // ========== GENERATE CONTRIBUTION ID ==========
        String finalContributionId;
        if (contributionId != null && !contributionId.isEmpty()) {
            finalContributionId = contributionId;
        } else {
            finalContributionId = "MPESA-" + groupIdTrimmed + "-" + memberIdTrimmed + "-" + System.currentTimeMillis();
        }
        
        System.out.println("\n🎯🎯🎯 NEW GROUP-AWARE PAYMENT REQUEST 🎯🎯🎯");
        System.out.println("🎯 Group: " + group.getGroupName() + " (ID: " + groupIdTrimmed + ")");
        System.out.println("🎯 Member: " + member.getFirstName() + " " + member.getLastName());
        System.out.println("🎯 Contribution ID: " + finalContributionId);
        System.out.println("🎯 Amount: " + amount + " KES");
        System.out.println("🎯 Transaction Type: " + transactionType);
        if (campaignId != null) {
            System.out.println("🎯 Campaign ID: " + campaignId);  // 👈 LOG campaignId
        }
        System.out.println("📱 Phone for payment: " + customerPhone + "\n");

        try {
            // Create TransactionDesc that includes transaction type for extraction in callback
            String transactionDesc = transactionType + "_" + member.getFirstName() + "_" + member.getLastName();
            
            System.out.println("\n📤📤📤 MPESA REQUEST DETAILS 📤📤📤");
            System.out.println("📤 Group: " + group.getGroupName());
            System.out.println("📤 Business Shortcode: " + group.getMpesaBusinessShortcode());
            System.out.println("📤 Amount: " + amount);
            System.out.println("📤 Phone: " + customerPhone);
            System.out.println("📤 AccountReference: GROUP_" + groupIdTrimmed + "_MEMBER_" + memberIdTrimmed);
            System.out.println("📤 TransactionDesc: " + transactionDesc);
            System.out.println("📤 Contribution ID for callback: " + finalContributionId);
            System.out.println("📤 Full Callback URL: " + group.getMpesaCallbackUrl() + "/" + finalContributionId);
            System.out.println("📤📤📤 END DEBUG 📤📤📤\n");
            
            // ========== STORE TRANSACTION TYPE, GROUP ID, MEMBER ID, AND CAMPAIGN ID IN CACHE ==========
            if (campaignId != null && !campaignId.isEmpty()) {
                // Store with campaignId
                transactionTypeCache.put(finalContributionId, 
                    new CacheEntry(transactionType, groupIdTrimmed, memberIdTrimmed, campaignId));
                System.out.println("💾 CACHED: transactionType='" + transactionType + 
                                  "', groupId='" + groupIdTrimmed + 
                                  "', memberId='" + memberIdTrimmed + 
                                  "', campaignId='" + campaignId + "'");
            } else {
                // Store without campaignId
                transactionTypeCache.put(finalContributionId, 
                    new CacheEntry(transactionType, groupIdTrimmed, memberIdTrimmed));
                System.out.println("💾 CACHED: transactionType='" + transactionType + 
                                  "', groupId='" + groupIdTrimmed + 
                                  "', memberId='" + memberIdTrimmed + "'");
            }
            System.out.println("💾 Cache key: " + finalContributionId);
            
            // ========== CALL UPDATED MPESA SERVICE WITH CONTRIBUTION ID ==========
            JSONObject mpesaResponse = mpesaService.sendStkPush(
                    groupIdTrimmed,      // Group ID
                    customerPhone,       // Phone number
                    amount,              // Amount
                    "GROUP_" + groupIdTrimmed + "_MEMBER_" + memberIdTrimmed,  // Account Reference
                    transactionDesc,     // Transaction Description
                    finalContributionId  // ✅ CRITICAL: Pass contribution ID for callback URL
            );

            // Check if STK push was successful
            if (mpesaResponse.has("ResponseCode") && 
                "0".equals(mpesaResponse.getString("ResponseCode"))) {
                
                // ========== 👇👇👇 ADD THIS NEW CODE HERE 👇👇👇 ==========
                // After successful STK push, create pending contribution in service cache
                if ("volunteer".equals(transactionType) && campaignId != null && !campaignId.isEmpty()) {
                    try {
                        contributionToCampaignService.createPendingContribution(
                            finalContributionId,
                            campaignId,
                            memberIdTrimmed,
                            groupIdTrimmed,
                            BigDecimal.valueOf(amount),
                            customerPhone,
                            transactionDesc,
                            member.getMansoftTenantId()
                        );
                        System.out.println("✅ Created pending contribution in service cache: " + finalContributionId);
                    } catch (Exception e) {
                        System.err.println("⚠️ Failed to create pending contribution: " + e.getMessage());
                        // Don't fail the payment, just log it
                        e.printStackTrace();
                    }
                }
                // ========== 👆👆👆 END OF NEW CODE 👆👆👆 ==========
                
                result.put("status", 200);
                result.put("message", "Payment initiated successfully");
                result.put("group", group.getGroupName());
                result.put("member", member.getFirstName() + " " + member.getLastName());
                result.put("amount", amount);
                result.put("phone", customerPhone);
                result.put("groupId", groupIdTrimmed);
                result.put("memberId", memberIdTrimmed);
                result.put("transactionType", transactionType);
                result.put("contributionId", finalContributionId);
                result.put("merchantRequestId", mpesaResponse.getString("MerchantRequestID"));
                result.put("checkoutRequestId", mpesaResponse.getString("CheckoutRequestID"));
                result.put("customerMessage", mpesaResponse.optString("CustomerMessage", "Check your phone for STK prompt"));
                result.put("businessShortcode", group.getMpesaBusinessShortcode());
                
                // Add campaignId to response if present
                if (campaignId != null) {
                    result.put("campaignId", campaignId);
                }
                
                // Log the callback URL that should be used
                System.out.println("\n🚀 STK Push successful! Waiting for payment...");
                System.out.println("📤 Callback URL sent to MPESA: " + 
                    mpesaResponse.optString("callbackUrlUsed", "Not available in response"));
                System.out.println("💳 Using group's business shortcode: " + group.getMpesaBusinessShortcode());
                System.out.println("🔗 Expected callback path: /api/payments/callback/" + finalContributionId);
                System.out.println("💾 Cache entry stored with memberId: " + memberIdTrimmed);
                if (campaignId != null) {
                    System.out.println("🎯 Cache entry includes campaignId: " + campaignId);
                }
                
                return ResponseEntity.ok().body(result);
            } else {
                // REMOVE FROM CACHE IF STK PUSH FAILED
                transactionTypeCache.remove(finalContributionId);
                System.out.println("🗑️ Removed from cache (STK push failed): " + finalContributionId);
                
                result.put("status", 500);
                result.put("message", "Failed to initiate STK Push: " + 
                    (mpesaResponse.has("error") ? mpesaResponse.getString("error") : 
                     mpesaResponse.optString("errorMessage", "Unknown error")));
                result.put("groupId", groupIdTrimmed);
                return ResponseEntity.status(500).body(result);
            }

        } catch (Exception e) {
            // REMOVE FROM CACHE IF EXCEPTION
            transactionTypeCache.remove(finalContributionId);
            System.out.println("🗑️ Removed from cache (exception): " + finalContributionId);
            
            result.put("status", 500);
            result.put("message", "Error sending STK Push: " + e.getMessage());
            result.put("groupId", groupIdTrimmed);
            e.printStackTrace();
            return ResponseEntity.status(500).body(result);
        }
    }
    
    // ========== NEW ENDPOINT: GET GROUP MPESA CONFIG ==========
    @GetMapping("/group-mpesa-config/{groupId}")
    public ResponseEntity<Map<String, Object>> getGroupMpesaConfig(@PathVariable String groupId) {
        Map<String, Object> result = new HashMap<>();
        
        try {
            JSONObject config = mpesaService.getGroupMpesaConfig(groupId);
            
            if (config.has("error")) {
                result.put("status", 400);
                result.put("message", config.getString("error"));
                return ResponseEntity.status(400).body(result);
            }
            
            result.put("status", 200);
            result.put("message", "MPESA configuration retrieved successfully");
            result.put("config", config.toMap());
            
            return ResponseEntity.ok().body(result);
            
        } catch (Exception e) {
            result.put("status", 500);
            result.put("message", "Error retrieving MPESA config: " + e.getMessage());
            return ResponseEntity.status(500).body(result);
        }
    }
    
    // ========== CACHE METHODS (UPDATED) ==========
    
    /**
     * Get transaction type and groupId from cache
     */
    public static CacheEntry getCachedEntry(String contributionId) {
        CacheEntry entry = transactionTypeCache.get(contributionId);
        if (entry != null) {
            if (entry.isExpired()) {
                transactionTypeCache.remove(contributionId);
                System.out.println("🗑️ Auto-removed expired cache entry: " + contributionId);
                return null;
            }
            return entry;
        }
        return null;
    }
    
    /**
     * Get transaction type from cache (backward compatibility)
     */
    public static String getCachedTransactionType(String contributionId) {
        CacheEntry entry = getCachedEntry(contributionId);
        return entry != null ? entry.getTransactionType() : null;
    }
    
    /**
     * Get groupId from cache
     */
    public static String getCachedGroupId(String contributionId) {
        CacheEntry entry = getCachedEntry(contributionId);
        return entry != null ? entry.getGroupId() : null;
    }
    
    /**
     * Get memberId from cache
     */
    public static String getCachedMemberId(String contributionId) {
        CacheEntry entry = getCachedEntry(contributionId);
        return entry != null ? entry.getMemberId() : null;
    }
    
    /**
     * Get campaignId from cache  // 👈 ADDED: New cache method
     */
    public static String getCachedCampaignId(String contributionId) {
        CacheEntry entry = getCachedEntry(contributionId);
        return entry != null ? entry.getCampaignId() : null;
    }
    
    /**
     * Remove transaction type from cache (after it's been used)
     */
    public static void removeFromCache(String contributionId) {
        transactionTypeCache.remove(contributionId);
    }
    
    /**
     * Get cache size (for debugging)
     */
    public static int getCacheSize() {
        return transactionTypeCache.size();
    }
    
    /**
     * Clean expired entries from cache
     */
    public static void cleanExpiredCacheEntries() {
        int initialSize = transactionTypeCache.size();
        transactionTypeCache.entrySet().removeIf(entry -> entry.getValue().isExpired());
        int removed = initialSize - transactionTypeCache.size();
        if (removed > 0) {
            System.out.println("🧹 Cleaned " + removed + " expired cache entries");
        }
    }
}