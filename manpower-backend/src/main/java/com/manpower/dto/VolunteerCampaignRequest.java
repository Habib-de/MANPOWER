package com.manpower.dto;

import lombok.Data;
import javax.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class VolunteerCampaignRequest {
    
    @NotBlank(message = "Campaign name is required")
    @Size(max = 200, message = "Campaign name must be less than 200 characters")
    private String campaignName;
    
    private String description;
    
    @DecimalMin(value = "0.0", inclusive = false, message = "Target amount must be greater than 0")
    private BigDecimal targetAmount;
    
    @NotNull(message = "Start date is required")
    @FutureOrPresent(message = "Start date cannot be in the past")
    private LocalDate startDate;
    
    @NotNull(message = "End date is required")
    @Future(message = "End date must be in the future")
    private LocalDate endDate;
    
    @NotBlank(message = "Group ID is required")
    private String groupId;
}