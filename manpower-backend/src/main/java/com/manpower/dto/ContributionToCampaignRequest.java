package com.manpower.dto;

import lombok.Data;
import javax.validation.constraints.*;
import java.math.BigDecimal;

@Data
public class ContributionToCampaignRequest {
    
    @NotBlank(message = "Campaign ID is required")
    private String campaignId;
    
    @NotNull(message = "Amount is required")
    @DecimalMin(value = "1.0", message = "Amount must be at least 1")
    private BigDecimal amount;
    
    @NotBlank(message = "Phone number is required")
    @Pattern(regexp = "^(07\\d{8}|7\\d{8}|\\+2547\\d{8}|2547\\d{8})$", 
             message = "Invalid phone number format. Use 07XXXXXXXX")
    private String phoneNumber;
    
    private String description;
}