package com.manpower.entity;

import javax.persistence.*;
import java.io.Serializable;
import java.math.BigDecimal;
import java.util.Date;

@Entity
@Table(name = "loans")
public class Loan implements Serializable {

    @Id
    @Column(name = "id", nullable = false, length = 40)
    private String id;

    @ManyToOne
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @Column(name = "amount", nullable = false)
    private BigDecimal amount;

    @Column(name = "interestRate")
    private BigDecimal interestRate;

    // A new field to store the calculated interest amount
    @Column(name = "calculated_interest")
    private BigDecimal calculatedInterest;

    @Column(name = "startDate")
    @Temporal(TemporalType.DATE)
    private Date startDate;

    @Column(name = "dueDate")
    @Temporal(TemporalType.DATE)
    private Date dueDate;

    @Column(name = "status", length = 50)
    private String status;

    @Column(name = "outstandingBalance")
    private BigDecimal outstandingBalance;

    // New field to track the total amount paid
    @Column(name = "total_paid")
    private BigDecimal totalPaid = BigDecimal.ZERO;

    @ManyToOne
    @JoinColumn(name = "approvedBy_member_id", nullable = false)
    private Member approvedBy;

    @Column(name = "created_by", length = 40)
    private String createdBy;

    @Column(name = "modified_by", length = 40)
    private String modifiedBy;

    @Column(name = "created_on", updatable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdOn = new Date();

    @Column(name = "modified_on")
    @Temporal(TemporalType.TIMESTAMP)
    private Date modifiedOn = new Date();

    @Column(name = "mansoft_tenant_id", length = 100)
    private String mansoftTenantId;

    // New field to store the reason for the loan
    @Column(name = "reason", length = 255)
    private String reason;

    @ManyToOne
    @JoinColumn(name = "guarantor_id")
    private Member guarantor;
    
    @Column(name = "guarantor_amount")
    private BigDecimal guarantorAmount;

    // ============ NEW FIELDS FOR ML INTEGRATION ============
    
    @Column(name = "ml_decision_log_id")
    private Long mlDecisionLogId; // Reference to the ML decision log

    @Column(name = "ml_approved_amount")
    private BigDecimal mlApprovedAmount; // The amount approved by ML system

    @Column(name = "ml_risk_level", length = 20)
    private String mlRiskLevel; // VERY_LOW, LOW, MEDIUM, HIGH, VERY_HIGH

    @Column(name = "ml_confidence_score")
    private BigDecimal mlConfidenceScore; // ML confidence score (0.0 - 1.0)

    @Column(name = "ml_recommendation", length = 50)
    private String mlRecommendation; // APPROVE, REJECT, APPROVE_WITH_CAUTION

    @Column(name = "is_ml_approved")
    private Boolean isMlApproved = false; // Flag indicating if loan was ML-approved

    @Column(name = "ml_eligibility_confidence")
    private BigDecimal mlEligibilityConfidence; // Eligibility confidence score

    @Column(name = "ml_sentiment_risk", length = 20)
    private String mlSentimentRisk; // LOW, MEDIUM, HIGH

    @Column(name = "ml_decision_reasoning", columnDefinition = "TEXT")
    private String mlDecisionReasoning; // ML reasoning for audit purposes

    // ============ CONSTRUCTORS ============

    public Loan() {
        // Default constructor
    }

    // Constructor for ML-approved loans
    public Loan(Member member, Group group, BigDecimal amount, String reason, 
                Long mlDecisionLogId, BigDecimal mlApprovedAmount, String mlRiskLevel,
                BigDecimal mlConfidenceScore, String mlRecommendation) {
        this.member = member;
        this.group = group;
        this.amount = amount;
        this.reason = reason;
        this.mlDecisionLogId = mlDecisionLogId;
        this.mlApprovedAmount = mlApprovedAmount;
        this.mlRiskLevel = mlRiskLevel;
        this.mlConfidenceScore = mlConfidenceScore;
        this.mlRecommendation = mlRecommendation;
        this.isMlApproved = "APPROVE".equals(mlRecommendation) || "APPROVE_WITH_CAUTION".equals(mlRecommendation);
        this.status = "ACTIVE";
        this.createdOn = new Date();
        this.modifiedOn = new Date();
    }

    // ============ GETTERS AND SETTERS ============

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Member getMember() {
        return member;
    }

    public void setMember(Member member) {
        this.member = member;
    }

    public Group getGroup() {
        return group;
    }

    public void setGroup(Group group) {
        this.group = group;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public BigDecimal getInterestRate() {
        return interestRate;
    }

    public void setInterestRate(BigDecimal interestRate) {
        this.interestRate = interestRate;
    }

    public BigDecimal getCalculatedInterest() {
        return calculatedInterest;
    }

    public void setCalculatedInterest(BigDecimal calculatedInterest) {
        this.calculatedInterest = calculatedInterest;
    }

    public Date getStartDate() {
        return startDate;
    }

    public void setStartDate(Date startDate) {
        this.startDate = startDate;
    }

    public Date getDueDate() {
        return dueDate;
    }

    public void setDueDate(Date dueDate) {
        this.dueDate = dueDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public BigDecimal getOutstandingBalance() {
        return outstandingBalance;
    }

    public void setOutstandingBalance(BigDecimal outstandingBalance) {
        this.outstandingBalance = outstandingBalance;
    }

    public BigDecimal getTotalPaid() {
        return totalPaid;
    }

    public void setTotalPaid(BigDecimal totalPaid) {
        this.totalPaid = totalPaid;
    }

    public Member getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(Member approvedBy) {
        this.approvedBy = approvedBy;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getModifiedBy() {
        return modifiedBy;
    }

    public void setModifiedBy(String modifiedBy) {
        this.modifiedBy = modifiedBy;
    }

    public Date getCreatedOn() {
        return createdOn;
    }

    public void setCreatedOn(Date createdOn) {
        this.createdOn = createdOn;
    }

    public Date getModifiedOn() {
        return modifiedOn;
    }

    public void setModifiedOn(Date modifiedOn) {
        this.modifiedOn = modifiedOn;
    }

    public String getMansoftTenantId() {
        return mansoftTenantId;
    }

    public void setMansoftTenantId(String mansoftTenantId) {
        this.mansoftTenantId = mansoftTenantId;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    // ============ ML INTEGRATION GETTERS AND SETTERS ============

    public Long getMlDecisionLogId() {
        return mlDecisionLogId;
    }

    public void setMlDecisionLogId(Long mlDecisionLogId) {
        this.mlDecisionLogId = mlDecisionLogId;
    }

    public BigDecimal getMlApprovedAmount() {
        return mlApprovedAmount;
    }

    public void setMlApprovedAmount(BigDecimal mlApprovedAmount) {
        this.mlApprovedAmount = mlApprovedAmount;
    }

    public String getMlRiskLevel() {
        return mlRiskLevel;
    }

    public void setMlRiskLevel(String mlRiskLevel) {
        this.mlRiskLevel = mlRiskLevel;
    }

    public BigDecimal getMlConfidenceScore() {
        return mlConfidenceScore;
    }

    public void setMlConfidenceScore(BigDecimal mlConfidenceScore) {
        this.mlConfidenceScore = mlConfidenceScore;
    }

    public String getMlRecommendation() {
        return mlRecommendation;
    }

    public void setMlRecommendation(String mlRecommendation) {
        this.mlRecommendation = mlRecommendation;
        // Auto-set the isMlApproved flag when recommendation is set
        this.isMlApproved = "APPROVE".equals(mlRecommendation) || "APPROVE_WITH_CAUTION".equals(mlRecommendation);
    }

    public Boolean getIsMlApproved() {
        return isMlApproved;
    }

    public void setIsMlApproved(Boolean isMlApproved) {
        this.isMlApproved = isMlApproved;
    }

    public BigDecimal getMlEligibilityConfidence() {
        return mlEligibilityConfidence;
    }

    public void setMlEligibilityConfidence(BigDecimal mlEligibilityConfidence) {
        this.mlEligibilityConfidence = mlEligibilityConfidence;
    }

    public String getMlSentimentRisk() {
        return mlSentimentRisk;
    }

    public void setMlSentimentRisk(String mlSentimentRisk) {
        this.mlSentimentRisk = mlSentimentRisk;
    }

    public String getMlDecisionReasoning() {
        return mlDecisionReasoning;
    }

    public void setMlDecisionReasoning(String mlDecisionReasoning) {
        this.mlDecisionReasoning = mlDecisionReasoning;
    }

    // ============ GUARANTOR GETTERS AND SETTERS ============
    
    public Member getGuarantor() {
        return guarantor;
    }

    public void setGuarantor(Member guarantor) {
        this.guarantor = guarantor;
    }

    public BigDecimal getGuarantorAmount() {
        return guarantorAmount;
    }

    public void setGuarantorAmount(BigDecimal guarantorAmount) {
        this.guarantorAmount = guarantorAmount;
    }

    // ============ HELPER METHODS ============

    /**
     * Helper method to check if this loan was approved by ML system
     */
    public boolean isMlApproved() {
        return Boolean.TRUE.equals(isMlApproved) && 
               ("APPROVE".equals(mlRecommendation) || "APPROVE_WITH_CAUTION".equals(mlRecommendation));
    }

    /**
     * Helper method to get display-friendly ML status
     */
    public String getMlStatusDisplay() {
        if (!isMlApproved()) {
            return "Not ML Approved";
        }
        
        switch (mlRiskLevel) {
            case "VERY_LOW": return "ML Approved - Low Risk";
            case "LOW": return "ML Approved - Low Risk";
            case "MEDIUM": return "ML Approved - Medium Risk";
            case "HIGH": return "ML Approved - High Risk";
            case "VERY_HIGH": return "ML Approved - High Risk";
            default: return "ML Approved";
        }
    }

    @Override
    public String toString() {
        return "Loan{" +
                "id='" + id + '\'' +
                ", member=" + (member != null ? member.getId() : "null") +
                ", amount=" + amount +
                ", status='" + status + '\'' +
                ", mlApproved=" + isMlApproved +
                ", mlRecommendation='" + mlRecommendation + '\'' +
                '}';
    }
}