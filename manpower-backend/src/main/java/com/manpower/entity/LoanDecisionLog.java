package com.manpower.entity;

import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "loan_decision_log")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoanDecisionLog {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String memberId;
    
    @Column(nullable = false)
    private Double requestedAmount;
    
    @Column(columnDefinition = "TEXT")
    private String loanReason;
    
    // ML Decision Results
    @Column(nullable = false)
    private String finalRecommendation; // APPROVE, REJECT, APPROVE_WITH_CAUTION
    
    @Column(nullable = false)
    private Double finalConfidence;
    
    private Double eligibilityAmount;
    private Double eligibilityConfidence;
    private String loanRisk;
    private Double riskProbability;
    private Double riskConfidence;
    private String sentimentRisk;
    private Double sentimentConfidence;
    
    @Column(columnDefinition = "TEXT")
    private String decisionReasoning;
    
    // Member context from assessment
    private String memberStatus;
    private String memberRole;
    private Double membershipMonths;
    
    @CreationTimestamp
    private LocalDateTime createdAt;
    
    // Additional fields for tracking
    private String mlOrchestratorVersion;
    private String dataSource;
    
    @Column(columnDefinition = "TEXT")
    private String rawMlResponse; // Store complete ML response for audit
    
    @Builder.Default
    private Boolean usedInLoanCreation = false; // Track if this decision led to actual loan
}