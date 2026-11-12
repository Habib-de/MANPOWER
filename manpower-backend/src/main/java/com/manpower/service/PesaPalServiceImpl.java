package com.manpower.service;

import com.manpower.config.PesaPalConfig;
import com.manpower.dto.PesaPalInitiateRequest;
import com.manpower.dto.PesaPalInitiateResponse;
import com.manpower.entity.Contribution;
import com.manpower.entity.Member;
import com.manpower.entity.Group;
import com.manpower.enums.TransactionStatus; // Import TransactionStatus enum
import com.manpower.enums.TransactionType; // Import TransactionType enum
import com.manpower.repository.ContributionRepository;
import com.manpower.repository.MemberRepository;
import com.manpower.repository.GroupRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
// import java.util.Base64; // REMOVED: Unused import
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class PesaPalServiceImpl implements PesaPalService {

    @Autowired
    private PesaPalConfig pesapalConfig;

    @Autowired
    private RestTemplate restTemplate;

    @Autowired
    private ContributionRepository contributionRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private GroupRepository groupRepository;

    private String pesapalAccessToken;
    private LocalDateTime tokenExpiry;

    /**
     * Helper method to get or refresh PesaPal access token.
     * Checks if the current token is null, expired, or about to expire.
     * If so, it calls refreshToken() to obtain a new one.
     * @return The valid PesaPal access token.
     */
    private String getPesapalAccessToken() {
        if (pesapalAccessToken == null || tokenExpiry == null || LocalDateTime.now().isAfter(tokenExpiry.minusMinutes(5))) {
            refreshToken();
        }
        return pesapalAccessToken;
    }

    /**
     * Refreshes the PesaPal access token by making a request to the PesaPal authentication endpoint.
     * Stores the new token and its expiry date.
     * Throws a RuntimeException if token refresh fails.
     */
    @SuppressWarnings("unchecked") // Suppress unchecked cast warning for Map.class
    private void refreshToken() {
        String tokenUrl = pesapalConfig.getPesapalApiBaseUrl() + "/Auth/RequestToken";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, String> requestBody = new HashMap<>();
        requestBody.put("consumer_key", pesapalConfig.getPesapalConsumerKey());
        requestBody.put("consumer_secret", pesapalConfig.getPesapalConsumerSecret());

        HttpEntity<Map<String, String>> entity = new HttpEntity<>(requestBody, headers);

        try {
            // Using explicit cast for Java 8 compatibility with generic type inference
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                tokenUrl,
                HttpMethod.POST,
                entity,
                (Class<Map<String, Object>>) (Class<?>) Map.class
            );
            
            // Re-assign body to a local variable after null check to satisfy cautious compilers
            Map<String, Object> responseBody = response.getBody(); // Declare inside if for stricter compilers, or check here
            if (response.getStatusCode().is2xxSuccessful() && responseBody != null) {
                pesapalAccessToken = (String) responseBody.get("token");
                Integer expiresIn = (Integer) responseBody.get("expiryDate"); // PesaPal returns expiryDate as int (seconds)
                tokenExpiry = LocalDateTime.now().plusSeconds(expiresIn != null ? expiresIn : 3600); // Default 1 hour if null
                System.out.println("PesaPal Token Refreshed. Expires: " + tokenExpiry);
            } else {
                String errorDetails = responseBody != null ? responseBody.toString() : "No error details"; // Use responseBody
                System.err.println("Failed to refresh PesaPal token: " + response.getStatusCode() + " " + errorDetails);
                throw new RuntimeException("Failed to refresh PesaPal token: " + errorDetails);
            }
        } catch (Exception e) {
            System.err.println("Error refreshing PesaPal token: " + e.getMessage());
            throw new RuntimeException("Error refreshing PesaPal token", e);
        }
    }

    /**
     * Initiates a PesaPal payment by sending an order request to the PesaPal API.
     * Saves a pending Contribution record in the database before returning the redirect URL.
     * @param request The PesaPalInitiateRequest DTO containing payment details.
     * @return PesaPalInitiateResponse containing the redirect URL and order tracking ID.
     * @throws IllegalArgumentException if Member or Group are not found.
     * @throws RuntimeException if PesaPal API interaction fails.
     */
    @Override
    @Transactional // Ensure the database operation is transactional
    @SuppressWarnings("unchecked") // Suppress unchecked cast warning for Map.class
    public PesaPalInitiateResponse initiatePayment(PesaPalInitiateRequest request) {
        String orderUrl = pesapalConfig.getPesapalApiBaseUrl() + "/Transactions/SubmitOrder";
        String accessToken = getPesapalAccessToken();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(accessToken);

        // Fetch Member and Group entities
        Optional<Member> memberOpt = memberRepository.findById(request.getMemberId());
        // Use !isPresent() for Java 8 compatibility
        if (!memberOpt.isPresent()) {
            throw new IllegalArgumentException("Member not found with ID: " + request.getMemberId());
        }

        Optional<Group> groupOpt = groupRepository.findById(request.getGroupId());
        // Use !isPresent() for Java 8 compatibility
        if (!groupOpt.isPresent()) {
            throw new IllegalArgumentException("Group not found with ID: " + request.getGroupId());
        }

        Member member = memberOpt.get();
        Group group = groupOpt.get();

        // Construct PesaPal request body
        Map<String, Object> pesapalRequestBody = new HashMap<>();
        pesapalRequestBody.put("id", UUID.randomUUID().toString()); // Unique ID for PesaPal transaction
        pesapalRequestBody.put("currency", "KES");
        pesapalRequestBody.put("amount", request.getAmount());
        pesapalRequestBody.put("description", request.getDescription());
        pesapalRequestBody.put("callback_url", pesapalConfig.getPesapalCallbackUrl()); // Your backend's webhook URL
        pesapalRequestBody.put("notification_id", "YOUR_PESAPAL_NOTIFICATION_ID"); // PesaPal Notification ID (from your PesaPal dashboard)
        pesapalRequestBody.put("branch", "DEFAULT"); // Example: default branch

        Map<String, String> billingAddress = new HashMap<>();
        billingAddress.put("email_address", member.getEmail());
        billingAddress.put("phone_number", request.getPhoneNumber()); // Use phone number from request
        billingAddress.put("first_name", member.getFirstName());
        billingAddress.put("last_name", member.getLastName());
        // Add more billing address details if required by PesaPal
        pesapalRequestBody.put("billing_address", billingAddress);

        HttpEntity<Map<String, Object>> entity = new HttpEntity<>(pesapalRequestBody, headers);

        try {
            // Parameterize Map for type safety and add null check for getBody()
            // Using explicit cast for Java 8 compatibility with generic type inference
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                orderUrl,
                HttpMethod.POST,
                entity,
                (Class<Map<String, Object>>) (Class<?>) Map.class
            );

            // Re-assign body to a local variable after null check to satisfy cautious compilers
            Map<String, Object> responseBody = response.getBody();
            if (response.getStatusCode().is2xxSuccessful() && responseBody != null) {
                String redirectUrl = (String) responseBody.get("redirect_url");
                String orderTrackingId = (String) responseBody.get("order_tracking_id");

                if (redirectUrl == null || orderTrackingId == null) {
                    throw new RuntimeException("PesaPal response missing redirectUrl or orderTrackingId");
                }

                // Save a pending Contribution record in your database
                Contribution contribution = new Contribution();
                // ID will be generated by JPA
                contribution.setMember(member);
                contribution.setGroup(group);
                contribution.setAmount(request.getAmount());
                contribution.setTransactionType(TransactionType.valueOf(request.getTransactionType())); // Convert string to enum
                contribution.setTransactionDate(LocalDate.now());
                contribution.setPaymentMethod("PesaPal");
                // Correctly reference TransactionStatus enum constant
                contribution.setStatus(TransactionStatus.Pending); // Initial status
                contribution.setDescription(request.getDescription() + " (PesaPal Order ID: " + orderTrackingId + ")");
                // Use getCreatedBy() from the request DTO
                contribution.setCreatedBy(request.getCreatedBy()); // Assuming createdBy is passed in request
                contribution.setModifiedBy(request.getCreatedBy()); // Modified by is same as createdBy for new contributions
                contribution.setMansoftTenantId(request.getMansoftTenantId());
                // Store PesaPal's orderTrackingId in the description or a dedicated field if you add one to Contribution
                // This is crucial for later status updates
                // For now, embedding in description. You might add a 'pesapalTrackingId' field to Contribution entity.

                contributionRepository.save(contribution);

                // Constructor PesaPalInitiateResponse(String, String) is now defined in the DTO
                return new PesaPalInitiateResponse(redirectUrl, orderTrackingId);

            } else {
                String errorDetails = responseBody != null ? responseBody.toString() : "No error details"; // Use responseBody
                System.err.println("Failed to initiate PesaPal payment: " + response.getStatusCode() + " " + errorDetails);
                throw new RuntimeException("Failed to initiate PesaPal payment: " + errorDetails);
            }
        } catch (Exception e) {
            System.err.println("Error initiating PesaPal payment: " + e.getMessage());
            throw new RuntimeException("Error initiating PesaPal payment", e);
        }
    }

    /**
     * Checks the status of a PesaPal payment using the order tracking ID.
     * @param orderTrackingId PesaPal's unique ID for the transaction.
     * @return The status of the payment (e.g., "COMPLETED", "FAILED", "PENDING", "UNKNOWN").
     */
    @Override
    @SuppressWarnings("unchecked") // Suppress unchecked cast warning for Map.class
    public String checkPaymentStatus(String orderTrackingId) {
        String statusUrl = pesapalConfig.getPesapalApiBaseUrl() + "/Transactions/GetTransactionStatus?orderTrackingId=" + orderTrackingId;
        String accessToken = getPesapalAccessToken();

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(accessToken);

        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            // Parameterize Map for type safety and add null check for getBody()
            // Using explicit cast for Java 8 compatibility with generic type inference
            ResponseEntity<Map<String, Object>> response = restTemplate.exchange(
                statusUrl,
                HttpMethod.GET,
                entity,
                (Class<Map<String, Object>>) (Class<?>) Map.class
            );

            // Re-assign body to a local variable after null check to satisfy cautious compilers
            Map<String, Object> responseBody = response.getBody();
            if (response.getStatusCode().is2xxSuccessful() && responseBody != null) {
                String status = (String) responseBody.get("status"); // PesaPal returns "status" field

                // Optional: Update the Contribution status in your database here
                // You would need to query your Contribution table using the orderTrackingId
                // (if you stored it in a dedicated field or parsed it from description)
                // and update its status.
                // Example (assuming you add a pesapalTrackingId field to Contribution):
                /*
                Optional<Contribution> contributionOpt = contributionRepository.findByPesapalTrackingId(orderTrackingId);
                if (contributionOpt.isPresent()) {
                    Contribution contribution = contributionOpt.get();
                    if ("COMPLETED".equals(status)) {
                        contribution.setStatus(TransactionStatus.Completed);
                    } else if ("FAILED".equals(status)) {
                        contribution.setStatus(TransactionStatus.Status.Failed); // Corrected enum reference
                    } else if ("CANCELLED".equals(status)) {
                        contribution.setStatus(TransactionStatus.Cancelled);
                    }
                    contributionRepository.save(contribution);
                }
                */

                return status; // Return the status string
            } else {
                String errorDetails = responseBody != null ? responseBody.toString() : "No error details"; // Use responseBody
                System.err.println("Failed to check PesaPal payment status: " + response.getStatusCode() + " " + errorDetails);
                return "UNKNOWN"; // Return UNKNOWN on API error
            }
        } catch (Exception e) {
            System.err.println("Error checking PesaPal payment status: " + e.getMessage());
            return "UNKNOWN"; // Return UNKNOWN on network/other error
        }
    }
}
