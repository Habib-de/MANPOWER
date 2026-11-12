package com.manpower.service;

import com.manpower.entity.Contribution;
import com.manpower.entity.Group;
import com.manpower.entity.Member;
import com.manpower.entity.VolunteerCampaign;
import com.manpower.enums.TransactionStatus;
import com.manpower.repository.ContributionRepository;
import com.manpower.repository.GroupRepository;
import com.manpower.repository.MemberRepository;
import com.manpower.repository.VolunteerCampaignRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
public class ContributionServiceImpl implements ContributionService {

    @Autowired
    private ContributionRepository contributionRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private GroupRepository groupRepository;
    
    @Autowired
    private VolunteerCampaignRepository volunteerCampaignRepository;

    @Override
    @Transactional
    public Contribution saveContribution(Contribution contribution) {
        if (contribution.getMember() == null || contribution.getMember().getId() == null) {
            throw new IllegalArgumentException("Contribution must be associated with a member (ID cannot be null).");
        }
        if (contribution.getGroup() == null || contribution.getGroup().getId() == null) {
            throw new IllegalArgumentException("Contribution must be associated with a group (ID cannot be null).");
        }

        Optional<Member> memberOpt = memberRepository.findById(contribution.getMember().getId());
        if (!memberOpt.isPresent()) {
            throw new IllegalArgumentException("Member with ID " + contribution.getMember().getId() + " not found.");
        }
        contribution.setMember(memberOpt.get());

        Optional<Group> groupOpt = groupRepository.findById(contribution.getGroup().getId());
        if (!groupOpt.isPresent()) {
            throw new IllegalArgumentException("Group with ID " + contribution.getGroup().getId() + " not found.");
        }
        contribution.setGroup(groupOpt.get());

        if (contribution.getVolunteerCampaign() != null && contribution.getVolunteerCampaign().getId() != null) {
            Optional<VolunteerCampaign> campaignOpt = volunteerCampaignRepository.findById(
                contribution.getVolunteerCampaign().getId()
            );
            if (campaignOpt.isPresent()) {
                contribution.setVolunteerCampaign(campaignOpt.get());
                System.out.println("✅ Linked contribution to campaign: " + campaignOpt.get().getCampaignName());
            } else {
                System.err.println("⚠️ Campaign not found with ID: " + contribution.getVolunteerCampaign().getId());
                contribution.setVolunteerCampaign(null);
            }
        }

        return contributionRepository.save(contribution);
    }

    @Override
    public List<Contribution> getAllContributions() {
        return contributionRepository.findAll();
    }

    @Override
    public Optional<Contribution> getContributionById(String id) {
        return contributionRepository.findById(id);
    }

    @Override
    public List<Contribution> getContributionsByMemberId(String memberId) {
        if (!memberRepository.existsById(memberId)) {
            throw new IllegalArgumentException("Member with ID " + memberId + " not found.");
        }
        return contributionRepository.findByMemberId(memberId);
    }

    @Override
    public List<Contribution> getContributionsByGroupId(String groupId) {
        if (!groupRepository.existsById(groupId)) {
            throw new IllegalArgumentException("Group with ID " + groupId + " not found.");
        }
        return contributionRepository.findByGroupId(groupId);
    }

    @Override
    @Transactional
    public void deleteContribution(String id) {
        if (!contributionRepository.existsById(id)) {
            throw new IllegalArgumentException("Contribution with ID " + id + " not found.");
        }
        contributionRepository.deleteById(id);
    }

    @Override
    public Map<String, Object> getContributionSummary(String groupId) {
        List<Contribution> contributions;

        if (groupId != null && !groupId.isEmpty()) {
            if (!groupRepository.existsById(groupId)) {
                throw new IllegalArgumentException("Group with ID " + groupId + " not found.");
            }
            contributions = contributionRepository.findByGroupId(groupId);
        } else {
            contributions = contributionRepository.findAll();
        }

        double total = contributions.stream()
                .mapToDouble(c -> c.getAmount().doubleValue())
                .sum();

        Map<String, Object> summary = new HashMap<>();
        summary.put("groupId", groupId);
        summary.put("totalContributions", total);
        summary.put("numberOfContributions", contributions.size());

        return summary;
    }

    @Override
    public BigDecimal getTotalContributionsByGroup(String groupId) {
        if (!groupRepository.existsById(groupId)) {
            throw new IllegalArgumentException("Group with ID " + groupId + " not found.");
        }
        return contributionRepository.sumByGroupId(groupId);
    }

    // ========== NEW UPDATE METHOD ==========
    
    @Override
    @Transactional
    public Contribution updateContribution(String id, Map<String, Object> updates) {
        Contribution contribution = contributionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Contribution not found with id: " + id));
        
        // Update status
        if (updates.containsKey("status")) {
            String statusValue = (String) updates.get("status");
            contribution.setStatus(TransactionStatus.valueOf(statusValue));
        }
        
        // Update payment date
        if (updates.containsKey("paymentDate")) {
            String paymentDateStr = (String) updates.get("paymentDate");
            contribution.setPaymentDate(LocalDate.parse(paymentDateStr));
        }
        
        // Update payment method
        if (updates.containsKey("paymentMethod")) {
            contribution.setPaymentMethod((String) updates.get("paymentMethod"));
        }
        
        // Update isLate
        if (updates.containsKey("isLate")) {
            contribution.setIsLate((Boolean) updates.get("isLate"));
        }
        
        // Update daysLate
        if (updates.containsKey("daysLate")) {
            Object daysLateObj = updates.get("daysLate");
            if (daysLateObj instanceof Integer) {
                contribution.setDaysLate((Integer) daysLateObj);
            } else if (daysLateObj instanceof Long) {
                contribution.setDaysLate(((Long) daysLateObj).intValue());
            }
        }
        
        // Update penaltyApplied
        if (updates.containsKey("penaltyApplied")) {
            Object penalty = updates.get("penaltyApplied");
            if (penalty instanceof Integer) {
                contribution.setPenaltyApplied(BigDecimal.valueOf((Integer) penalty));
            } else if (penalty instanceof Double) {
                contribution.setPenaltyApplied(BigDecimal.valueOf((Double) penalty));
            } else if (penalty instanceof BigDecimal) {
                contribution.setPenaltyApplied((BigDecimal) penalty);
            }
        }
        
        // Update amount (if penalty was added)
        if (updates.containsKey("amount")) {
            Object amount = updates.get("amount");
            if (amount instanceof Integer) {
                contribution.setAmount(BigDecimal.valueOf((Integer) amount));
            } else if (amount instanceof Double) {
                contribution.setAmount(BigDecimal.valueOf((Double) amount));
            } else if (amount instanceof BigDecimal) {
                contribution.setAmount((BigDecimal) amount);
            }
        }
        
        // Update description
        if (updates.containsKey("description")) {
            contribution.setDescription((String) updates.get("description"));
        }
        
        // Update modifiedBy
        if (updates.containsKey("modifiedBy")) {
            contribution.setModifiedBy((String) updates.get("modifiedBy"));
        }
        
        // Update modifiedOn
        if (updates.containsKey("modifiedOn")) {
            String modifiedOnStr = (String) updates.get("modifiedOn");
            contribution.setModifiedOn(LocalDateTime.parse(modifiedOnStr));
        }
        
        return contributionRepository.save(contribution);
    }
}