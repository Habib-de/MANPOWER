package com.manpower.repository;

import com.manpower.entity.VolunteerCampaign;
import com.manpower.enums.CampaignStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface VolunteerCampaignRepository extends JpaRepository<VolunteerCampaign, String> {

    // Get all campaigns for a group
    List<VolunteerCampaign> findByGroupId(String groupId);
    
    // Get campaigns by status for a group
    List<VolunteerCampaign> findByGroupIdAndStatus(String groupId, CampaignStatus status);
    
    // Get ONLY open campaigns (ACTIVE + within date range)
    @Query("SELECT vc FROM VolunteerCampaign vc WHERE vc.group.id = :groupId " +
           "AND vc.status = 'ACTIVE' " +
           "AND vc.startDate <= :currentDate " +
           "AND vc.endDate >= :currentDate")
    List<VolunteerCampaign> findOpenCampaigns(@Param("groupId") String groupId, 
                                              @Param("currentDate") LocalDate currentDate);
    
    // Auto-close expired campaigns (scheduled job)
    @Query("SELECT vc FROM VolunteerCampaign vc " +
           "WHERE vc.status = 'ACTIVE' AND vc.endDate < :currentDate")
    List<VolunteerCampaign> findExpiredActiveCampaigns(@Param("currentDate") LocalDate currentDate);
    
    // Search campaigns by name
    @Query("SELECT vc FROM VolunteerCampaign vc WHERE vc.group.id = :groupId " +
           "AND LOWER(vc.campaignName) LIKE LOWER(CONCAT('%', :searchTerm, '%'))")
    List<VolunteerCampaign> searchByCampaignName(@Param("groupId") String groupId, 
                                                 @Param("searchTerm") String searchTerm);
    
    // Get campaigns created by a specific member
    List<VolunteerCampaign> findByCreatedById(String memberId);
    
    // Count active campaigns in a group
    long countByGroupIdAndStatus(String groupId, CampaignStatus status);
}