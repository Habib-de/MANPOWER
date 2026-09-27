package com.manpower.dto;

import com.manpower.entity.Group.ContributionFrequency;
import java.math.BigDecimal;

public class GroupSettingsDTO {
    
    private ContributionFrequency contributionFrequency;
    private BigDecimal expectedContributionAmount;
    private Boolean enablePenalty;
    private BigDecimal penaltyAmount;
    private Integer gracePeriodDays;
    private Boolean enableReminders;
    private Integer reminderDaysBefore;
    private Integer contributionDueDay;
    
    // Default constructor
    public GroupSettingsDTO() {}
    
    // Getters and Setters
    public ContributionFrequency getContributionFrequency() {
        return contributionFrequency;
    }
    
    public void setContributionFrequency(ContributionFrequency contributionFrequency) {
        this.contributionFrequency = contributionFrequency;
    }
    
    public BigDecimal getExpectedContributionAmount() {
        return expectedContributionAmount;
    }
    
    public void setExpectedContributionAmount(BigDecimal expectedContributionAmount) {
        this.expectedContributionAmount = expectedContributionAmount;
    }
    
    public Boolean getEnablePenalty() {
        return enablePenalty;
    }
    
    public void setEnablePenalty(Boolean enablePenalty) {
        this.enablePenalty = enablePenalty;
    }
    
    public BigDecimal getPenaltyAmount() {
        return penaltyAmount;
    }
    
    public void setPenaltyAmount(BigDecimal penaltyAmount) {
        this.penaltyAmount = penaltyAmount;
    }
    
    public Integer getGracePeriodDays() {
        return gracePeriodDays;
    }
    
    public void setGracePeriodDays(Integer gracePeriodDays) {
        this.gracePeriodDays = gracePeriodDays;
    }
    
    public Boolean getEnableReminders() {
        return enableReminders;
    }
    
    public void setEnableReminders(Boolean enableReminders) {
        this.enableReminders = enableReminders;
    }
    
    public Integer getReminderDaysBefore() {
        return reminderDaysBefore;
    }
    
    public void setReminderDaysBefore(Integer reminderDaysBefore) {
        this.reminderDaysBefore = reminderDaysBefore;
    }
    
    public Integer getContributionDueDay() {
        return contributionDueDay;
    }
    
    public void setContributionDueDay(Integer contributionDueDay) {
        this.contributionDueDay = contributionDueDay;
    }
}