package com.manpower.service;

import com.manpower.entity.Group;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Base64;
import java.util.Date;

@Service
public class MpesaService {

    @Autowired
    private GroupService groupService;

    // ----------------- GENERATE ACCESS TOKEN (Group-specific) -----------------
    public String getAccessToken(final String consumerKey, final String consumerSecret) {
        try {
            String url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

            String auth = consumerKey + ":" + consumerSecret;
            String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes("UTF-8"));

            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Basic " + encodedAuth);

            BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;

            while ((line = br.readLine()) != null) sb.append(line);
            br.close();

            JSONObject json = new JSONObject(sb.toString());
            System.out.println("TOKEN RESPONSE: " + json);

            return json.getString("access_token");

        } catch (Exception e) {
            System.out.println("FAILED TO GET ACCESS TOKEN for consumerKey: " + consumerKey);
            e.printStackTrace();
            return null;
        }
    }

    // ----------------- SEND STK PUSH (Group-specific) - UPDATED -----------------
    public JSONObject sendStkPush(
            final String groupId,
            final String customerMSISDN,
            final int amount,
            final String accountReference,
            final String transactionDesc,
            final String contributionId) { // NEW: Added contributionId parameter

        try {
            // 1. Get group with active MPESA credentials
            Group group = groupService.getGroupWithActiveMpesa(groupId)
                    .orElseThrow(() -> new RuntimeException("❌ Group not found or MPESA not active for group: " + groupId));

            // 2. Extract group-specific credentials
            String consumerKey = group.getMpesaConsumerKey();
            String consumerSecret = group.getMpesaConsumerSecret();
            String businessShortCode = group.getMpesaBusinessShortcode();
            String passKey = group.getMpesaPasskey();
            String baseCallbackUrl = group.getMpesaCallbackUrl();

            // 3. Validate credentials
            if (consumerKey == null || consumerKey.isEmpty() ||
                consumerSecret == null || consumerSecret.isEmpty()) {
                throw new RuntimeException("❌ MPESA credentials not configured for group: " + groupId);
            }

            // 4. Get access token with group's credentials
            String accessToken = getAccessToken(consumerKey, consumerSecret);
            if (accessToken == null) {
                throw new RuntimeException("❌ Failed to get access token for group: " + groupId);
            }

            // 5. Prepare password and callback URL WITH CONTRIBUTION ID
            String timestamp = new SimpleDateFormat("yyyyMMddHHmmss").format(new Date());
            String rawPassword = businessShortCode + passKey + timestamp;
            String password = Base64.getEncoder().encodeToString(rawPassword.getBytes("UTF-8"));

            // Build full callback URL with contribution ID
            String fullCallbackUrl = buildCallbackUrl(baseCallbackUrl, contributionId);

            System.out.println("\n=== MPESA Request for Group: " + group.getGroupName() + " ===");
            System.out.println("BusinessShortCode: " + businessShortCode);
            System.out.println("Timestamp: " + timestamp);
            System.out.println("Account Reference: " + accountReference);
            System.out.println("Contribution ID: " + contributionId);
            System.out.println("Base Callback URL: " + baseCallbackUrl);
            System.out.println("Full Callback URL: " + fullCallbackUrl); // CRITICAL: Log this!
            System.out.println("Amount: " + amount + "\n");

            // 6. Prepare payload
            JSONObject payload = new JSONObject();
            payload.put("BusinessShortCode", businessShortCode);
            payload.put("Password", password);
            payload.put("Timestamp", timestamp);
            payload.put("TransactionType", "CustomerPayBillOnline");
            payload.put("Amount", amount);
            payload.put("PartyA", customerMSISDN);
            payload.put("PartyB", businessShortCode);
            payload.put("PhoneNumber", customerMSISDN);
            payload.put("CallBackURL", fullCallbackUrl); // Use full URL with contribution ID
            payload.put("AccountReference", accountReference);
            payload.put("TransactionDesc", transactionDesc);

            // 7. Determine API endpoint (sandbox vs live based on business shortcode)
            String apiUrl = businessShortCode.equals("174379") 
                    ? "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
                    : "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

            URL url = new URL(apiUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setDoOutput(true);

            // 8. Send request
            OutputStream os = conn.getOutputStream();
            os.write(payload.toString().getBytes());
            os.flush();
            os.close();

            // 9. Get response
            int responseCode = conn.getResponseCode();
            BufferedReader br = new BufferedReader(new InputStreamReader(
                    responseCode >= 200 && responseCode < 300 ?
                            conn.getInputStream() : conn.getErrorStream()
            ));

            StringBuilder response = new StringBuilder();
            String ln;
            while ((ln = br.readLine()) != null) response.append(ln);
            br.close();

            System.out.println("STK PUSH RESPONSE CODE: " + responseCode);
            System.out.println("STK PUSH RESPONSE: " + response);

            JSONObject result = new JSONObject(response.toString());
            
            // 10. Add group info to response
            result.put("groupId", groupId);
            result.put("groupName", group.getGroupName());
            result.put("businessShortcode", businessShortCode);
            result.put("contributionId", contributionId);
            result.put("callbackUrlUsed", fullCallbackUrl);

            return result;

        } catch (Exception e) {
            System.out.println("❌ ERROR DURING STK PUSH for group: " + groupId);
            e.printStackTrace();
            JSONObject error = new JSONObject();
            error.put("error", e.getMessage());
            error.put("groupId", groupId);
            error.put("contributionId", contributionId);
            error.put("success", false);
            return error;
        }
    }

    // ----------------- BUILD CALLBACK URL WITH CONTRIBUTION ID -----------------
    private String buildCallbackUrl(String baseUrl, String contributionId) {
        if (baseUrl == null || baseUrl.isEmpty()) {
            throw new RuntimeException("Base callback URL cannot be null or empty");
        }
        
        if (contributionId == null || contributionId.isEmpty()) {
            throw new RuntimeException("Contribution ID cannot be null or empty for callback URL");
        }
        
        // Remove trailing slash if present
        if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }
        
        // Build full URL
        String fullUrl = baseUrl + "/" + contributionId;
        
        System.out.println("🔗 Building callback URL:");
        System.out.println("  Base: " + baseUrl);
        System.out.println("  Contribution ID: " + contributionId);
        System.out.println("  Full: " + fullUrl);
        
        return fullUrl;
    }

    // ----------------- SIMULATE PAYMENT (Updated) -----------------
    public void initiatePayment(String groupId, String contributionId, int contributionAmount, 
                                int paidAmount, String createdBy, String paymentType) {
        if (createdBy == null || createdBy.isEmpty()) {
            createdBy = "SYSTEM";
        }

        String contributionStatus = paidAmount >= contributionAmount ? "PAID" : "PARTIALLY PAID";

        System.out.println("===================================");
        System.out.println("Group ID: " + groupId);
        System.out.println("Contribution ID: " + contributionId);
        System.out.println("Amount Paid: " + paidAmount);
        System.out.println("Created By: " + createdBy);
        System.out.println("Payment Mode: " + "MPESA");
        System.out.println("Payment Type: " + paymentType);
        System.out.println("Payment Date: " + new Date());
        System.out.println("New Contribution Status: " + contributionStatus);
        System.out.println("===================================");
    }

    // ----------------- GET MPESA CREDENTIALS FOR GROUP -----------------
    public JSONObject getGroupMpesaConfig(String groupId) {
        try {
            Group group = groupService.getGroupWithActiveMpesa(groupId)
                    .orElseThrow(() -> new RuntimeException("Group not found or MPESA not active"));

            JSONObject config = new JSONObject();
            config.put("groupId", groupId);
            config.put("groupName", group.getGroupName());
            config.put("businessShortcode", group.getMpesaBusinessShortcode());
            config.put("callbackUrl", group.getMpesaCallbackUrl());
            config.put("isActive", group.getMpesaIsActive());
            config.put("lastConfigured", group.getMpesaLastConfigured());
            
            // Don't expose sensitive keys in response
            config.put("hasConsumerKey", group.getMpesaConsumerKey() != null && !group.getMpesaConsumerKey().isEmpty());
            config.put("hasConsumerSecret", group.getMpesaConsumerSecret() != null && !group.getMpesaConsumerSecret().isEmpty());
            config.put("hasPasskey", group.getMpesaPasskey() != null && !group.getMpesaPasskey().isEmpty());

            return config;
        } catch (Exception e) {
            JSONObject error = new JSONObject();
            error.put("error", e.getMessage());
            error.put("groupId", groupId);
            return error;
        }
    }

    // ----------------- BACKWARD COMPATIBILITY METHOD -----------------
    public JSONObject sendStkPush(
            final String groupId,
            final String customerMSISDN,
            final int amount,
            final String accountReference,
            final String transactionDesc) {
        
        System.err.println("⚠️ WARNING: Using deprecated sendStkPush without contributionId!");
        System.err.println("⚠️ This will cause 404 errors in callbacks!");
        
        // Generate a temporary contribution ID for backward compatibility
        String tempContributionId = "TEMP-" + groupId + "-" + System.currentTimeMillis();
        
        return sendStkPush(groupId, customerMSISDN, amount, accountReference, 
                          transactionDesc, tempContributionId);
    }
}