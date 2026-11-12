package com.manpower.dto;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CampaignContributionResponse {
    private String contributionId;
    private String campaignId;
    private String campaignName;
    private String memberId;
    private String memberName;
    private BigDecimal amount;
    private LocalDateTime contributionDate;
    private String status;
    private String transactionId;
}