package com.manpower.service;

import com.manpower.dto.VolunteerCampaignRequest;
import com.manpower.dto.VolunteerCampaignResponse;
import com.manpower.entity.Group;
import com.manpower.entity.Member;
import com.manpower.entity.VolunteerCampaign;
import com.manpower.enums.CampaignStatus;
import com.manpower.repository.ContributionRepository;
import com.manpower.repository.GroupRepository;
import com.manpower.repository.MemberRepository;
import com.manpower.repository.VolunteerCampaignRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VolunteerCampaignService {

    private final VolunteerCampaignRepository campaignRepository;
    private final GroupRepository groupRepository;
    private final MemberRepository memberRepository;
    private final ContributionRepository contributionRepository;

    /**
     * CREATE a new volunteer campaign (Group Admin only)
     */
    @Transactional
    public VolunteerCampaignResponse createCampaign(VolunteerCampaignRequest request, String createdByMemberId) {
        // Validate dates
        if (request.getStartDate().isAfter(request.getEndDate())) {
            throw new IllegalArgumentException("Start date must be before end date");
        }

        // Get group and creator
        Group group = groupRepository.findById(request.getGroupId())
            .orElseThrow(() -> new RuntimeException("Group not found with ID: " + request.getGroupId()));
        
        Member creator = memberRepository.findById(createdByMemberId)
            .orElseThrow(() -> new RuntimeException("Member not found with ID: " + createdByMemberId));

        // Create new campaign
        VolunteerCampaign campaign = new VolunteerCampaign();
        campaign.setGroup(group);
        campaign.setCampaignName(request.getCampaignName());
        campaign.setDescription(request.getDescription());
        campaign.setTargetAmount(request.getTargetAmount());
        campaign.setRaisedAmount(BigDecimal.ZERO);
        campaign.setStartDate(request.getStartDate());
        campaign.setEndDate(request.getEndDate());
        campaign.setStatus(CampaignStatus.ACTIVE);
        campaign.setCreatedBy(creator);
        campaign.setCreatedOn(LocalDateTime.now());
        campaign.setModifiedOn(LocalDateTime.now());

        VolunteerCampaign saved = campaignRepository.save(campaign);
        return mapToResponse(saved);
    }

    /**
     * GET all campaigns for a group (with optional status filter)
     */
    @Transactional(readOnly = true)
    public List<VolunteerCampaignResponse> getGroupCampaigns(String groupId, String status) {
        List<VolunteerCampaign> campaigns;
        
        if (status != null && !status.isEmpty()) {
            try {
                CampaignStatus campaignStatus = CampaignStatus.valueOf(status.toUpperCase());
                campaigns = campaignRepository.findByGroupIdAndStatus(groupId, campaignStatus);
            } catch (IllegalArgumentException e) {
                campaigns = campaignRepository.findByGroupId(groupId);
            }
        } else {
            campaigns = campaignRepository.findByGroupId(groupId);
        }
        
        return campaigns.stream()
            .map(this::mapToResponse)
            .collect(Collectors.toList());
    }

    /**
     * GET ONLY open campaigns for members to contribute to
     */
    @Transactional(readOnly = true)
    public List<VolunteerCampaignResponse> getOpenCampaigns(String groupId) {
        LocalDate today = LocalDate.now();
        List<VolunteerCampaign> campaigns = campaignRepository.findOpenCampaigns(groupId, today);
        
        return campaigns.stream()
            .map(this::mapToResponse)
            .collect(Collectors.toList());
    }

    /**
     * GET a single campaign by ID
     */
    @Transactional(readOnly = true)
    public VolunteerCampaignResponse getCampaignById(String campaignId) {
        VolunteerCampaign campaign = campaignRepository.findById(campaignId)
            .orElseThrow(() -> new RuntimeException("Campaign not found with ID: " + campaignId));
        
        return mapToResponse(campaign);
    }

    /**
     * UPDATE campaign status (Close, Complete, Cancel)
     */
    @Transactional
    public VolunteerCampaignResponse updateCampaignStatus(String campaignId, String status, String modifiedBy) {
        VolunteerCampaign campaign = campaignRepository.findById(campaignId)
            .orElseThrow(() -> new RuntimeException("Campaign not found with ID: " + campaignId));
        
        try {
            CampaignStatus newStatus = CampaignStatus.valueOf(status.toUpperCase());
            campaign.setStatus(newStatus);
            campaign.setModifiedBy(modifiedBy);
            campaign.setModifiedOn(LocalDateTime.now());
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid status value: " + status);
        }
        
        return mapToResponse(campaignRepository.save(campaign));
    }

    /**
     * AUTO-CLOSE expired campaigns (called by scheduler)
     */
    @Transactional
    public int autoCloseExpiredCampaigns() {
        LocalDate today = LocalDate.now();
        List<VolunteerCampaign> expiredCampaigns = campaignRepository.findExpiredActiveCampaigns(today);
        
        expiredCampaigns.forEach(campaign -> {
            campaign.setStatus(CampaignStatus.CLOSED);
            campaign.setModifiedOn(LocalDateTime.now());
        });
        
        campaignRepository.saveAll(expiredCampaigns);
        return expiredCampaigns.size();
    }

    /**
     * DELETE campaign (only if no contributions)
     */
    @Transactional
    public void deleteCampaign(String campaignId) {
        VolunteerCampaign campaign = campaignRepository.findById(campaignId)
            .orElseThrow(() -> new RuntimeException("Campaign not found with ID: " + campaignId));
        
        // ✅ FIXED: Handle Object[] casting properly
        Object[] stats = contributionRepository.getVolunteerCampaignStats(campaignId);
        BigDecimal totalRaised = BigDecimal.ZERO;
        
        if (stats != null && stats.length >= 1) {
            if (stats[0] instanceof BigDecimal) {
                totalRaised = (BigDecimal) stats[0];
            } else if (stats[0] != null) {
                totalRaised = new BigDecimal(stats[0].toString());
            }
        }
        
        if (totalRaised.compareTo(BigDecimal.ZERO) > 0) {
            throw new RuntimeException("Cannot delete campaign with existing contributions");
        }
        
        campaignRepository.delete(campaign);
    }

    /**
     * PRIVATE method to map Entity to Response DTO
     * ✅ FIXED: Properly handle Object[] casting with null safety
     */
    private VolunteerCampaignResponse mapToResponse(VolunteerCampaign campaign) {
        // Get campaign statistics
        Object[] stats = contributionRepository.getVolunteerCampaignStats(campaign.getId());
        
        // ✅ FIXED: Initialize with defaults
        BigDecimal totalRaised = BigDecimal.ZERO;
        Long contributorCount = 0L;
        Long totalContributions = 0L;
        
        // ✅ FIXED: Safe casting with null checks
        if (stats != null && stats.length >= 3) {
            // Handle totalRaised (stats[0])
            if (stats[0] instanceof BigDecimal) {
                totalRaised = (BigDecimal) stats[0];
            } else if (stats[0] != null) {
                try {
                    totalRaised = new BigDecimal(stats[0].toString());
                } catch (NumberFormatException e) {
                    totalRaised = BigDecimal.ZERO;
                }
            }
            
            // Handle contributorCount (stats[1])
            if (stats[1] instanceof Long) {
                contributorCount = (Long) stats[1];
            } else if (stats[1] != null) {
                try {
                    contributorCount = Long.parseLong(stats[1].toString());
                } catch (NumberFormatException e) {
                    contributorCount = 0L;
                }
            }
            
            // Handle totalContributions (stats[2])
            if (stats[2] instanceof Long) {
                totalContributions = (Long) stats[2];
            } else if (stats[2] != null) {
                try {
                    totalContributions = Long.parseLong(stats[2].toString());
                } catch (NumberFormatException e) {
                    totalContributions = 0L;
                }
            }
        }

        // Calculate progress percentage
        BigDecimal progress = BigDecimal.ZERO;
        if (campaign.getTargetAmount() != null && campaign.getTargetAmount().compareTo(BigDecimal.ZERO) > 0) {
            progress = totalRaised
                .multiply(BigDecimal.valueOf(100))
                .divide(campaign.getTargetAmount(), 2, RoundingMode.HALF_UP);
        }

        // Calculate days remaining
        LocalDate today = LocalDate.now();
        long daysRemaining = ChronoUnit.DAYS.between(today, campaign.getEndDate());
        
        // Check if campaign is open (ACTIVE and within date range)
        boolean isOpen = campaign.getStatus() == CampaignStatus.ACTIVE &&
                        !today.isBefore(campaign.getStartDate()) &&
                        !today.isAfter(campaign.getEndDate());
        
        boolean isExpired = campaign.getStatus() == CampaignStatus.ACTIVE && 
                           today.isAfter(campaign.getEndDate());

        return VolunteerCampaignResponse.builder()
            .id(campaign.getId())
            .groupId(campaign.getGroup().getId())
            .groupName(campaign.getGroup().getGroupName())
            .campaignName(campaign.getCampaignName())
            .description(campaign.getDescription())
            .targetAmount(campaign.getTargetAmount())
            .raisedAmount(totalRaised != null ? totalRaised : BigDecimal.ZERO)
            .progress(progress)
            .startDate(campaign.getStartDate())
            .endDate(campaign.getEndDate())
            .status(campaign.getStatus().name())
            .createdBy(campaign.getCreatedBy().getId())
            .createdByName(campaign.getCreatedBy().getFirstName() + " " + campaign.getCreatedBy().getLastName())
            .createdOn(campaign.getCreatedOn())
            .contributorCount(contributorCount != null ? contributorCount.intValue() : 0)
            .totalContributions(totalContributions != null ? totalContributions.intValue() : 0)
            .daysRemaining(daysRemaining > 0 ? daysRemaining : 0)
            .isOpen(isOpen)
            .isExpired(isExpired)
            .build();
    }
}