package com.manpower.dto;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VolunteerCampaignResponse {
    private String id;
    private String groupId;
    private String groupName;
    private String campaignName;
    private String description;
    private BigDecimal targetAmount;
    private BigDecimal raisedAmount;
    private BigDecimal progress; // percentage
    private LocalDate startDate;
    private LocalDate endDate;
    private String status;
    private String createdBy;
    private String createdByName;
    private LocalDateTime createdOn;
    private Integer contributorCount;
    private Integer totalContributions;
    private Long daysRemaining;
    private Boolean isOpen;
    private Boolean isExpired;
}