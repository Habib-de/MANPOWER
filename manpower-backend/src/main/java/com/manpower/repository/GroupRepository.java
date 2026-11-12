package com.manpower.repository;

import com.manpower.entity.Group;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GroupRepository extends JpaRepository<Group, String> {

    // ✅ Existing methods
    List<Group> findByCreatedBy(String createdBy);
    List<Group> findByMpesaIsActiveTrue();
    Optional<Group> findByIdAndMpesaIsActiveTrue(String id);
    Optional<Group> findByMpesaBusinessShortcode(String businessShortcode);
    
    // ========== NEW METHODS FOR CONTRIBUTION SETTINGS ==========
    
    // Find all groups that have contribution settings configured
    @Query("SELECT g FROM Group g WHERE g.contributionFrequency IS NOT NULL AND g.expectedContributionAmount IS NOT NULL")
    List<Group> findAllGroupsWithContributionSettings();
    
    // Find groups that have penalties enabled
    @Query("SELECT g FROM Group g WHERE g.enablePenalty = true AND g.contributionFrequency IS NOT NULL")
    List<Group> findAllGroupsWithPenaltiesEnabled();
    
    // Find groups that have reminders enabled
    @Query("SELECT g FROM Group g WHERE g.enableReminders = true AND g.nextContributionDate IS NOT NULL")
    List<Group> findAllGroupsWithRemindersEnabled();
    
    // Find groups where next contribution date is before a given date (for scheduling)
    @Query("SELECT g FROM Group g WHERE g.nextContributionDate <= :date AND g.contributionFrequency IS NOT NULL")
    List<Group> findGroupsWithNextContributionDateBefore(@Param("date") java.time.LocalDate date);
}