package com.manpower.dto;

import lombok.Data;
import javax.validation.constraints.*;

@Data
public class LoanAssessmentRequest {
    
    @NotBlank(message = "Member ID is required")
    private String memberId;
    
    @NotBlank(message = "Member status is required")
    private String memberStatus; // Active, Inactive, Terminated
    
    @NotBlank(message = "Member role is required") 
    private String memberRole; // Member, GroupAdmin, SuperAdmin
    
    @NotBlank(message = "Join date is required")
    private String joinDate; // YYYY-MM-DD format
    
    @NotNull(message = "Loan amount is required")
    @Positive(message = "Loan amount must be positive")
    private Double loanAmount;
    
    @NotBlank(message = "Loan reason is required")
    @Size(min = 10, message = "Loan reason must be at least 10 characters")
    private String loanReason;
}