package com.manpower.controller;

import com.manpower.entity.Contribution;
import com.manpower.entity.Group;
import com.manpower.entity.Member;
import com.manpower.entity.Loan;
import com.manpower.enums.TransactionStatus;
import com.manpower.enums.TransactionType;
import com.manpower.repository.MemberRepository;
import com.manpower.repository.LoanRepository;
import com.manpower.service.ContributionService;
import com.manpower.service.GroupService;
import com.manpower.service.ContributionToCampaignService;
import com.manpower.dto.CampaignContributionResponse;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/payments")
@CrossOrigin(origins = "*")
public class PaymentCallbackController {

    @Autowired
    private ContributionService contributionService;
    
    @Autowired
    private MemberRepository memberRepository;
    
    @Autowired
    private GroupService groupService;
    
    @Autowired
    private LoanRepository loanRepository;
    
    // ========== ADD THIS AUTOWIRED SERVICE FOR VOLUNTEER CAMPAIGNS ==========
    @Autowired
    private ContributionToCampaignService contributionToCampaignService;
    
    // ========== GETTER FOR INTERNAL USE ==========
    public ContributionToCampaignService getContributionToCampaignService() {
        return contributionToCampaignService;
    }

    // ========== FALLBACK ENDPOINT FOR WHEN MPESA CALLS WITHOUT CONTRIBUTION ID ==========
    @PostMapping("/callback")
    public ResponseEntity<Map<String, Object>> handleCallbackWithoutId(
            @RequestBody String jsonCallback,
            HttpServletRequest request) {
        
        Map<String, Object> response = new HashMap<>();
        
        System.out.println("\n⚠️⚠️⚠️ MPESA CALLING WRONG URL - NO CONTRIBUTION ID IN PATH ⚠️⚠️⚠️");
        System.out.println("📅 Time: " + new java.util.Date());
        System.out.println("🔗 URL Called: " + request.getRequestURL());
        System.out.println("📌 Path: " + request.getRequestURI());
        
        try {
            JSONObject root = new JSONObject(jsonCallback);
            JSONObject stkCallback = root.getJSONObject("Body").getJSONObject("stkCallback");
            
            String checkoutRequestId = stkCallback.getString("CheckoutRequestID");
            String merchantRequestId = stkCallback.getString("MerchantRequestID");
            int resultCode = stkCallback.getInt("ResultCode");
            String resultDesc = stkCallback.getString("ResultDesc");
            
            System.out.println("🔍 CheckoutRequestID: " + checkoutRequestId);
            System.out.println("🔍 MerchantRequestID: " + merchantRequestId);
            System.out.println("📊 Result Code: " + resultCode);
            System.out.println("📊 Result Desc: " + resultDesc);
            
            // Try to extract AccountReference to generate contributionId
            if (resultCode == 0 && stkCallback.has("CallbackMetadata")) {
                JSONObject metadata = stkCallback.getJSONObject("CallbackMetadata");
                String accountReference = null;
                
                for (Object o : metadata.getJSONArray("Item")) {
                    try {
                        JSONObject item = (JSONObject) o;
                        if ("AccountReference".equals(item.optString("Name", ""))) {
                            // Use optString to avoid JSONException if Value doesn't exist
                            accountReference = item.optString("Value", null);
                            if (accountReference != null) {
                                System.out.println("🔍 Found AccountReference: " + accountReference);
                                
                                // Extract groupId and memberId from AccountReference
                                if (accountReference.contains("GROUP_") && 
                                    accountReference.contains("MEMBER_")) {
                                    
                                    String[] refParts = accountReference.split("_");
                                    if (refParts.length >= 4) {
                                        String groupId = refParts[1];
                                        String memberId = refParts[3];
                                        
                                        // Generate a contribution ID
                                        String generatedContributionId = "MPESA-" + groupId + "-" + memberId + "-GENERATED";
                                        System.out.println("🔄 Generated Contribution ID: " + generatedContributionId);
                                        
                                        // Forward to the main handler with generated ID
                                        System.out.println("🔄 Forwarding to: /callback/" + generatedContributionId);
                                        handleCallback(jsonCallback, generatedContributionId);
                                        
                                        response.put("status", "forwarded");
                                        response.put("message", "Callback forwarded to proper endpoint");
                                        response.put("generatedContributionId", generatedContributionId);
                                        return ResponseEntity.ok(response);
                                    }
                                }
                            }
                        }
                    } catch (Exception e) {
                        System.err.println("⚠️ Error processing item in fallback: " + e.getMessage());
                        // Continue with next item
                    }
                }
            }
            
            // Log for investigation
            logCallbackIssue(checkoutRequestId, merchantRequestId, request.getRequestURI(), resultCode);
            
            response.put("status", "received");
            response.put("message", "Callback received via wrong URL (missing contributionId)");
            response.put("issue", "MPESA service not sending correct CallBackURL");
            response.put("checkoutRequestId", checkoutRequestId);
            response.put("merchantRequestId", merchantRequestId);
            response.put("resultCode", resultCode);
            response.put("resultDesc", resultDesc);
            response.put("actionRequired", "Update MpesaService.sendStkPush() to include contributionId in CallBackURL");
            
        } catch (Exception e) {
            System.err.println("💥 Error in fallback callback: " + e.getMessage());
            e.printStackTrace();
            response.put("error", e.getMessage());
        }
        
        // Always return 200 to MPESA
        return ResponseEntity.ok(response);
    }

    @PostMapping("/callback/{contributionId}")
    public ResponseEntity<Void> handleCallback(
            @RequestBody String jsonCallback,
            @PathVariable("contributionId") String contributionId) {

        System.out.println("\n============================================================");
        System.out.println("🔥🔥🔥 M-PESA CALLBACK RECEIVED 🔥🔥🔥");
        System.out.println("📅 Time: " + new java.util.Date());
        System.out.println("🔗 Contribution ID from URL: " + contributionId);
        
        // Print the raw JSON to see what MPESA is actually sending
        System.out.println("📋 RAW CALLBACK JSON (First 1000 chars):");
        System.out.println(jsonCallback.length() > 1000 ? jsonCallback.substring(0, 1000) + "..." : jsonCallback);
        System.out.println("============================================================\n");

        try {
            JSONObject root = new JSONObject(jsonCallback);
            JSONObject stkCallback = root.getJSONObject("Body").getJSONObject("stkCallback");

            int resultCode = stkCallback.getInt("ResultCode");
            String resultDesc = stkCallback.getString("ResultDesc");
            String merchantRequestId = stkCallback.getString("MerchantRequestID");
            String checkoutRequestId = stkCallback.getString("CheckoutRequestID");

            System.out.println("📊 Result Code: " + resultCode);
            System.out.println("📊 Result Desc: " + resultDesc);
            System.out.println("📊 Merchant Request ID: " + merchantRequestId);
            System.out.println("📊 Checkout Request ID: " + checkoutRequestId);

            if (resultCode == 0) {
                // SUCCESS
                JSONObject metadata = stkCallback.getJSONObject("CallbackMetadata");
                
                // Log ALL items in the callback metadata
                System.out.println("\n🔍 DEBUG - All items in CallbackMetadata:");
                try {
                    for (Object o : metadata.getJSONArray("Item")) {
                        try {
                            JSONObject item = (JSONObject) o;
                            String name = item.optString("Name", "");
                            if (item.has("Value")) {
                                Object value = item.get("Value");
                                System.out.println("  - " + name + ": " + value);
                                
                                if ("AccountReference".equals(name)) {
                                    System.out.println("🔍 DEBUG 2: Found AccountReference value: " + value);
                                }
                            } else {
                                System.out.println("  - " + name + ": [NO VALUE]");
                            }
                        } catch (Exception e) {
                            System.err.println("⚠️ Error logging item: " + e.getMessage());
                        }
                    }
                } catch (Exception e) {
                    System.err.println("⚠️ Error processing metadata array: " + e.getMessage());
                }
                System.out.println("🔍 END DEBUG\n");
                
                String receipt = null;
                int amount = 0;
                String phone = null;
                String transactionType = "Contribution"; // Default value
                String transactionDesc = null;
                String accountReference = null;

                // Process metadata items with proper error handling
                try {
                    for (Object o : metadata.getJSONArray("Item")) {
                        try {
                            JSONObject item = (JSONObject) o;
                            String name = item.optString("Name", "");
                            
                            // Check if the item has a Value field
                            if (!item.has("Value")) {
                                System.out.println("ℹ️ Item '" + name + "' has no Value field, skipping");
                                continue;
                            }
                            
                            Object value = item.get("Value");

                            switch (name) {
                                case "MpesaReceiptNumber":
                                    receipt = value.toString();
                                    System.out.println("✅ Found receipt: " + receipt);
                                    break;
                                case "Amount":
                                    try {
                                        amount = item.getInt("Value");
                                        System.out.println("✅ Found amount: " + amount);
                                    } catch (Exception e) {
                                        amount = (int) item.getDouble("Value");
                                        System.out.println("✅ Found amount (as double): " + amount);
                                    }
                                    break;
                                case "PhoneNumber":
                                    phone = value.toString();
                                    System.out.println("✅ Found phone: " + phone);
                                    break;
                                case "TransactionDesc":
                                    transactionDesc = value.toString();
                                    System.out.println("🔍 TransactionDesc from MPESA: " + transactionDesc);
                                    break;
                                case "AccountReference":
                                    accountReference = value.toString();
                                    System.out.println("🔍 AccountReference from MPESA: " + accountReference);
                                    break;
                                case "TransactionDate":
                                    String transactionDate = value.toString();
                                    System.out.println("✅ TransactionDate: " + transactionDate);
                                    break;
                                default:
                                    System.out.println("ℹ️ Unprocessed item: " + name + " = " + value);
                                    break;
                            }
                        } catch (Exception e) {
                            System.err.println("⚠️ Error processing metadata item: " + e.getMessage());
                        }
                    }
                } catch (Exception e) {
                    System.err.println("⚠️ Error processing metadata array: " + e.getMessage());
                }

                // ========== GET GROUP ID, TRANSACTION TYPE, AND MEMBER ID FROM CACHE ==========
                String groupId = null;
                String memberId = null;
                boolean foundInCache = false;
                
                // 1. FIRST: Try to get from CACHE
                PaymentController.CacheEntry cachedEntry = PaymentController.getCachedEntry(contributionId);
                if (cachedEntry != null) {
                    transactionType = cachedEntry.getTransactionType();
                    groupId = cachedEntry.getGroupId();
                    memberId = cachedEntry.getMemberId();
                    
                    System.out.println("💾 Retrieved from CACHE - Group: " + groupId + 
                                      ", Member: " + memberId + ", Type: " + transactionType);
                    foundInCache = true;
                    
                    PaymentController.removeFromCache(contributionId);
                    System.out.println("🗑️ Removed from cache after retrieval: " + contributionId);
                    System.out.println("💾 Remaining cache size: " + PaymentController.getCacheSize());
                }
                
                // 2. SECOND: If not in cache, extract from contributionId
                if (!foundInCache) {
                    System.out.println("⚠️ Entry not found in cache, extracting from contribution ID...");
                    
                    String[] idParts = extractIdsFromContributionId(contributionId);
                    if (idParts != null) {
                        groupId = idParts[0];
                        memberId = idParts[1];
                        System.out.println("🔍 Extracted from Contribution ID - Group: " + groupId + ", Member: " + memberId);
                    }
                    
                    // Try to extract transaction type from TransactionDesc
                    if (transactionDesc != null && transactionDesc.contains("_")) {
                        String[] parts = transactionDesc.split("_");
                        if (parts.length >= 1) {
                            transactionType = parts[0];
                            System.out.println("🎯 Extracted transaction type from TransactionDesc: " + transactionType);
                        }
                    }
                }

                // ========== TRY ADDITIONAL SOURCES FOR MEMBER ID ==========
                if (memberId == null && accountReference != null) {
                    if (accountReference.contains("GROUP_") && accountReference.contains("MEMBER_")) {
                        String[] refParts = accountReference.split("_");
                        if (refParts.length >= 4) {
                            memberId = refParts[3];
                            System.out.println("🔍 Extracted memberId from AccountReference: " + memberId);
                            
                            if (groupId == null && refParts.length > 1) {
                                groupId = refParts[1];
                                System.out.println("🔍 Also extracted groupId from AccountReference: " + groupId);
                            }
                        }
                    }
                }

                // ========== VALIDATE GROUP ==========
                if (groupId != null && !groupId.isEmpty()) {
                    Optional<Group> groupOpt = groupService.getGroupWithActiveMpesa(groupId);
                    if (groupOpt.isPresent()) {
                        Group group = groupOpt.get();
                        System.out.println("✅ Validated group: " + group.getGroupName());
                    } else {
                        System.out.println("⚠️ Group not found or MPESA not active: " + groupId);
                    }
                }

                System.out.println("\n============================================================");
                System.out.println("✅ PAYMENT SUCCESS ✅");
                System.out.println("💰 Amount: KES " + amount);
                System.out.println("🧾 Receipt: " + receipt);
                System.out.println("📱 Phone used: " + phone);
                System.out.println("💳 Transaction Type: " + transactionType);
                System.out.println("🏢 Group ID: " + (groupId != null ? groupId : "Unknown"));
                System.out.println("👤 Member ID: " + (memberId != null ? memberId : "Unknown"));
                System.out.println("🔗 Contribution ID: " + contributionId);
                System.out.println("============================================================\n");

                if (memberId != null && !memberId.isEmpty()) {
                    System.out.println("🔍 Member ID to lookup: " + memberId);
                    
                    Optional<Member> memberOpt = memberRepository.findById(memberId.trim());
                    
                    if (memberOpt.isPresent()) {
                        Member member = memberOpt.get();
                        
                        System.out.println("👤 Found member: " + member.getFirstName() + " " + member.getLastName());
                        System.out.println("📞 Member's registered phone: " + member.getPhoneNumber());
                        System.out.println("📱 Phone used for payment: " + phone);
                        
                        // ========== VALIDATE MEMBER BELONGS TO GROUP ==========
                        if (groupId != null && member.getGroup() != null) {
                            if (!member.getGroup().getId().equals(groupId)) {
                                System.out.println("⚠️ WARNING: Member belongs to group '" + member.getGroup().getGroupName() + 
                                                 "' but payment is for group ID: " + groupId);
                            }
                        }
                        
                        // ========== CRITICAL FIX: HANDLE VOLUNTEER CAMPAIGNS VIA CAMPAIGN SERVICE ==========
                        if (transactionType.equalsIgnoreCase("volunteer")) {
                            System.out.println("\n🎯 VOLUNTEER CAMPAIGN DETECTED - Using Campaign Service");
                            
                            try {
                                // Complete the contribution in Campaign Service (this creates the contribution)
                                CampaignContributionResponse campaignResponse = 
                                    contributionToCampaignService.completeContribution(contributionId, receipt);
                                
                                System.out.println("✅ Volunteer campaign contribution completed!");
                                if (campaignResponse != null) {
                                    System.out.println("📊 Campaign: " + campaignResponse.getCampaignName());
                                    System.out.println("💰 Amount: KES " + campaignResponse.getAmount());
                                    System.out.println("🎯 Status: " + campaignResponse.getStatus());
                                    System.out.println("📝 Contribution DB ID: " + campaignResponse.getContributionId());
                                }
                            } catch (Exception e) {
                                System.err.println("❌ Error in volunteer campaign completion: " + e.getMessage());
                                e.printStackTrace();
                                // Don't throw - we still want to return 200 OK to M-Pesa
                            }
                        } 
                        // ========== HANDLE NON-VOLUNTEER TRANSACTIONS (Contribution, Loan_Payment, etc.) ==========
                        else {
                            // Create contribution record directly
                            Contribution contribution = new Contribution();
                            contribution.setMember(member);
                            
                            // Set group
                            if (member.getGroup() != null) {
                                contribution.setGroup(member.getGroup());
                                System.out.println("🏢 Group from member: " + member.getGroup().getGroupName());
                            } else if (groupId != null) {
                                Optional<Group> groupForContribution = groupService.getGroupById(groupId);
                                if (groupForContribution.isPresent()) {
                                    contribution.setGroup(groupForContribution.get());
                                    System.out.println("🏢 Group from extracted ID: " + groupForContribution.get().getGroupName());
                                }
                            }
                            
                            // SET TRANSACTION TYPE
                            try {
                                TransactionType type = TransactionType.valueOf(transactionType);
                                contribution.setTransactionType(type);
                                System.out.println("✅ Transaction Type set to: " + type);
                            } catch (IllegalArgumentException e) {
                                System.out.println("⚠️ Invalid transaction type: " + transactionType + 
                                                 ", defaulting to Contribution");
                                contribution.setTransactionType(TransactionType.Contribution);
                            }
                            
                            contribution.setAmount(BigDecimal.valueOf(amount));
                            contribution.setTransactionDate(LocalDate.now());
                            contribution.setPaymentMethod("MPESA");
                            contribution.setStatus(TransactionStatus.Completed);
                            
                            // Description
                            StringBuilder descBuilder = new StringBuilder();
                            descBuilder.append(transactionType).append(" Payment");
                            if (receipt != null) descBuilder.append(" | Receipt: ").append(receipt);
                            if (phone != null) descBuilder.append(" | Phone: ").append(phone);
                            descBuilder.append(" | Member: ").append(member.getFirstName()).append(" ").append(member.getLastName());
                            if (contribution.getGroup() != null) {
                                descBuilder.append(" | Group: ").append(contribution.getGroup().getGroupName());
                            }
                            contribution.setDescription(descBuilder.toString());
                            
                            contribution.setCreatedBy("MPESA_SYSTEM");
                            contribution.setModifiedBy("MPESA_SYSTEM");
                            contribution.setMansoftTenantId(member.getMansoftTenantId());
                            
                            // Save contribution
                            Contribution savedContribution = contributionService.saveContribution(contribution);
                            
                            if (savedContribution != null) {
                                System.out.println("\n============================================================");
                                System.out.println("🎉🎉🎉 CONTRIBUTION SAVED SUCCESSFULLY! 🎉🎉🎉");
                                System.out.println("📝 Contribution DB ID: " + savedContribution.getId());
                                System.out.println("👤 Member: " + member.getFirstName() + " " + member.getLastName());
                                if (savedContribution.getGroup() != null) {
                                    System.out.println("🏢 Group: " + savedContribution.getGroup().getGroupName());
                                }
                                System.out.println("💰 Amount: KES " + amount);
                                System.out.println("💳 Transaction Type: " + savedContribution.getTransactionType());
                                System.out.println("🧾 MPESA Receipt: " + receipt);
                                System.out.println("🔗 Original Contribution ID: " + contributionId);
                                System.out.println("============================================================\n");
                            } else {
                                System.err.println("\n============================================================");
                                System.err.println("❌❌❌ FAILED TO SAVE CONTRIBUTION ❌❌❌");
                                System.err.println("❌ Contribution returned null from service");
                                System.err.println("❌ Member: " + member.getFirstName() + " " + member.getLastName());
                                System.err.println("❌ Amount: KES " + amount);
                                System.err.println("❌ Receipt: " + receipt);
                                System.err.println("============================================================\n");
                            }
                        }
                        
                        // ========== LOAN REPAYMENT LOGIC (Common for both paths) ==========
                        if (transactionType.equalsIgnoreCase("Loan_Payment")) {
    System.out.println("\n🔍 LOAN REPAYMENT DETECTED - Processing loan update...");
    
    try {
        // Find member's active loan using String status values
        List<Loan> activeLoans = loanRepository.findByMemberAndStatusIn(
            member,
            Arrays.asList("APPROVED", "ACTIVE", "OVERDUE")
        );
        
        if (!activeLoans.isEmpty()) {
            // Member should only have ONE active loan
            Loan activeLoan = activeLoans.get(0);
            BigDecimal paymentAmount = BigDecimal.valueOf(amount);
            
            System.out.println("✅ Found active loan ID: " + activeLoan.getId());
            
            // Get current outstanding balance
            BigDecimal currentOutstanding = activeLoan.getOutstandingBalance();
            if (currentOutstanding == null) {
                // Fallback if outstanding is null
                BigDecimal loanAmount = activeLoan.getAmount() != null ? 
                    activeLoan.getAmount() : BigDecimal.ZERO;
                BigDecimal totalPaid = activeLoan.getTotalPaid() != null ? 
                    activeLoan.getTotalPaid() : BigDecimal.ZERO;
                currentOutstanding = loanAmount.subtract(totalPaid);
                System.out.println("⚠️ Outstanding was null, calculated: KES " + currentOutstanding);
            }
            
            System.out.println("💰 Current outstanding balance: KES " + currentOutstanding);
            System.out.println("💵 Payment amount: KES " + paymentAmount);
            
            // Calculate new outstanding (Current Outstanding - This Payment)
            BigDecimal newOutstanding = currentOutstanding.subtract(paymentAmount);
            
            // Ensure outstanding doesn't go negative
            if (newOutstanding.compareTo(BigDecimal.ZERO) < 0) {
                System.out.println("⚠️ Payment exceeds outstanding! Adjusting...");
                newOutstanding = BigDecimal.ZERO;
            }
            
            // Update total paid
            BigDecimal currentTotalPaid = activeLoan.getTotalPaid() != null ? 
                activeLoan.getTotalPaid() : BigDecimal.ZERO;
            BigDecimal newTotalPaid = currentTotalPaid.add(paymentAmount);
            
            // Update loan
            activeLoan.setTotalPaid(newTotalPaid);
            activeLoan.setOutstandingBalance(newOutstanding);
            
            // If fully paid
            if (newOutstanding.compareTo(BigDecimal.ZERO) <= 0) {
                activeLoan.setStatus("PAID");
                activeLoan.setOutstandingBalance(BigDecimal.ZERO);
                System.out.println("🎉🎉🎉 Loan FULLY PAID! 🎉🎉🎉");
            }
            
            // Save updated loan
            loanRepository.save(activeLoan);
            
            System.out.println("✅ Loan updated successfully!");
            System.out.println("💰 New total paid: KES " + newTotalPaid);
            System.out.println("💰 New outstanding balance: KES " + newOutstanding);
            System.out.println("📊 New loan status: " + activeLoan.getStatus());
            
        } else {
            System.out.println("⚠️ No active loan found for member: " + member.getId());
            System.out.println("   Member has no loans with status: APPROVED, ACTIVE, or OVERDUE");
        }
    } catch (Exception e) {
        System.err.println("❌❌❌ Error processing loan repayment: " + e.getMessage());
        e.printStackTrace();
        // Don't throw - we still want to return 200 OK to M-Pesa
    }
}
                        // ========== END LOAN REPAYMENT LOGIC ==========
                        
                    } else {
                        System.out.println("❌ Member not found with ID: " + memberId);
                        logUnmatchedPayment(contributionId, amount, receipt, phone, memberId, 
                                          transactionType, groupId);
                    }
                } else {
                    System.out.println("❌ Could not extract memberId");
                    logUnmatchedPayment(contributionId, amount, receipt, phone, null, 
                                      transactionType, groupId);
                }

            } else {
                // PAYMENT FAILED
                System.out.println("\n============================================================");
                System.out.println("❌ PAYMENT FAILED ❌");
                System.out.println("📛 Reason: " + resultDesc);
                System.out.println("💡 Contribution ID: " + contributionId);
                System.out.println("============================================================\n");
                
                // Notify campaign service about failed payment
                try {
                    contributionToCampaignService.handleFailedPayment(contributionId, resultDesc);
                } catch (Exception e) {
                    System.err.println("⚠️ Error notifying campaign service of failed payment: " + e.getMessage());
                }
                
                logFailedPayment(contributionId, resultCode, resultDesc, merchantRequestId, checkoutRequestId);
            }

        } catch (Exception e) {
            System.err.println("\n============================================================");
            System.err.println("💥💥💥 ERROR PROCESSING CALLBACK 💥💥💥");
            e.printStackTrace();
            System.err.println("Contribution ID: " + contributionId);
            System.err.println("Raw callback data: " + jsonCallback);
            System.err.println("============================================================\n");
        }

        return ResponseEntity.ok().build();
    }
    
    /**
     * Extract groupId and memberId from contributionId
     */
    private String[] extractIdsFromContributionId(String contributionId) {
        if (contributionId == null || contributionId.trim().isEmpty()) {
            System.out.println("❌ Contribution ID is null or empty");
            return null;
        }
        
        System.out.println("🔍 Extracting IDs from: " + contributionId);
        
        if (!contributionId.startsWith("MPESA-")) {
            System.out.println("❌ Invalid format: Doesn't start with 'MPESA-'");
            return null;
        }
        
        try {
            String withoutPrefix = contributionId.substring(6);
            String[] parts = withoutPrefix.split("-");
            
            if (parts.length >= 3) {
                String groupId = parts[0];
                String memberId = parts[1];
                
                // Handle UUIDs that were split
                if (parts.length > 3) {
                    StringBuilder memberIdBuilder = new StringBuilder(parts[1]);
                    for (int i = 2; i < parts.length - 1; i++) {
                        memberIdBuilder.append("-").append(parts[i]);
                    }
                    memberId = memberIdBuilder.toString();
                }
                
                System.out.println("✅ Extracted - Group ID: " + groupId + ", Member ID: " + memberId);
                return new String[]{groupId, memberId};
            } else {
                System.out.println("❌ Not enough parts after splitting");
                return null;
            }
        } catch (Exception e) {
            System.out.println("❌ Error extracting IDs: " + e.getMessage());
            return null;
        }
    }
    
    /**
     * Log unmatched payments
     */
    private void logUnmatchedPayment(String contributionId, int amount, String receipt, 
                                    String phone, String attemptedMemberId, 
                                    String transactionType, String groupId) {
        System.err.println("\n============================================================");
        System.err.println("🚨🚨🚨 UNMATCHED PAYMENT - NEEDS MANUAL REVIEW 🚨🚨🚨");
        System.err.println("  Contribution ID: " + contributionId);
        System.err.println("  Amount: KES " + amount);
        System.err.println("  Receipt: " + receipt);
        System.err.println("  Phone used: " + phone);
        System.err.println("  Transaction Type: " + transactionType);
        System.err.println("  Group ID: " + (groupId != null ? groupId : "Unknown"));
        System.err.println("  Attempted Member ID: " + (attemptedMemberId != null ? attemptedMemberId : "Unknown"));
        System.err.println("  Time: " + new java.util.Date());
        System.err.println("============================================================\n");
    }
    
    /**
     * Log failed payments
     */
    private void logFailedPayment(String contributionId, int resultCode, String resultDesc,
                                 String merchantRequestId, String checkoutRequestId) {
        System.err.println("\n============================================================");
        System.err.println("📝 FAILED PAYMENT LOG:");
        System.err.println("  Contribution ID: " + contributionId);
        System.err.println("  Result Code: " + resultCode);
        System.err.println("  Result Desc: " + resultDesc);
        System.err.println("  Merchant Request ID: " + merchantRequestId);
        System.err.println("  Checkout Request ID: " + checkoutRequestId);
        System.err.println("  Time: " + new java.util.Date());
        System.err.println("============================================================\n");
    }
    
    /**
     * Log callback URL issues
     */
    private void logCallbackIssue(String checkoutId, String merchantId, String uri, int resultCode) {
        String logMsg = String.format(
            "\n🚨🚨🚨 MPESA CALLBACK URL ISSUE DETECTED 🚨🚨🚨\n" +
            "Time: %s\n" +
            "URL Path Called: %s\n" +
            "CheckoutRequestID: %s\n" +
            "MerchantRequestID: %s\n" +
            "Result Code: %d\n" +
            "Issue: MPESA called URL without contributionId\n" +
            "Root Cause: CallBackURL in STK push missing contributionId\n" +
            "Fix: Ensure PaymentController passes contributionId to MpesaService.sendStkPush()\n" +
            "🚨🚨🚨 END ISSUE LOG 🚨🚨🚨\n",
            new java.util.Date(), uri, checkoutId, merchantId, resultCode
        );
        
        System.err.println(logMsg);
    }
}