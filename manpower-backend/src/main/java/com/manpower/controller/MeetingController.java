package com.manpower.controller;

import com.manpower.entity.Meeting;
import com.manpower.service.MeetingService;
import com.manpower.repository.GroupRepository;
import com.manpower.dto.ErrorResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@CrossOrigin(origins = {"http://localhost:8081", "http://192.168.0.101:8081"})
@RestController
@RequestMapping("/api/meetings")
public class MeetingController {

    @Autowired
    private MeetingService meetingService;

    @Autowired
    private GroupRepository groupRepository;

    // ✅ Helper method to parse LocalDateTime from various formats
    private LocalDateTime parseLocalDateTime(Object dateTimeObj) {
        if (dateTimeObj == null) return null;
        
        try {
            String dateTimeStr = dateTimeObj.toString();
            
            // ✅ Handle ISO format with Z (UTC)
            if (dateTimeStr.endsWith("Z")) {
                // Remove the 'Z' and parse
                String withoutZ = dateTimeStr.substring(0, dateTimeStr.length() - 1);
                return LocalDateTime.parse(withoutZ, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
            }
            
            // ✅ Try standard ISO format
            return LocalDateTime.parse(dateTimeStr, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (DateTimeParseException e) {
            System.err.println("❌ Failed to parse date: " + dateTimeObj + " - " + e.getMessage());
            return null;
        }
    }

    // ✅ Helper method to parse LocalDate
    private LocalDate parseLocalDate(Object dateObj) {
        if (dateObj == null) return null;
        try {
            String dateStr = dateObj.toString();
            return LocalDate.parse(dateStr, DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException e) {
            System.err.println("❌ Failed to parse date: " + dateObj);
            return null;
        }
    }

    // ✅ Helper method to parse LocalTime
    private LocalTime parseLocalTime(Object timeObj) {
        if (timeObj == null) return null;
        try {
            String timeStr = timeObj.toString();
            // Handle time with seconds
            if (timeStr.length() == 8) { // HH:MM:SS
                return LocalTime.parse(timeStr, DateTimeFormatter.ISO_LOCAL_TIME);
            }
            // Handle time without seconds (HH:MM)
            return LocalTime.parse(timeStr, DateTimeFormatter.ofPattern("HH:mm"));
        } catch (DateTimeParseException e) {
            System.err.println("❌ Failed to parse time: " + timeObj);
            return null;
        }
    }

    @PostMapping
    public ResponseEntity<Object> createMeeting(@Valid @RequestBody Meeting meeting) {
        try {
            String role = meeting.getCalledByRole();
            String target = meeting.getTargetAudience();

            // ✅ Validate required fields
            if (meeting.getTitle() == null || meeting.getAgenda() == null ||
                meeting.getMeetingDate() == null || meeting.getMeetingTime() == null ||
                role == null || target == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(new ErrorResponse("Missing required meeting fields."));
            }

            // ✅ Rule 1: SuperAdmin logic
            if ("SuperAdmin".equalsIgnoreCase(role)) {
                if (!"GroupAdmins".equalsIgnoreCase(target)) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(new ErrorResponse("SuperAdmin can only target GroupAdmins."));
                }

                if (meeting.getGroup() != null) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(new ErrorResponse("SuperAdmin should not assign a specific group."));
                }
            }

            // ✅ Rule 2: GroupAdmin logic
            if ("GroupAdmin".equalsIgnoreCase(role)) {
                if (!"GroupMembers".equalsIgnoreCase(target)) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(new ErrorResponse("GroupAdmin can only target GroupMembers."));
                }

                if (meeting.getGroup() == null || meeting.getGroup().getId() == null ||
                    !groupRepository.existsById(meeting.getGroup().getId())) {
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                            .body(new ErrorResponse("GroupAdmin must provide a valid group."));
                }
            }

            // ✅ Save meeting
            Meeting saved = meetingService.saveMeeting(meeting);
            return new ResponseEntity<>(saved, HttpStatus.CREATED);

        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(new ErrorResponse(e.getMessage()), HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            return new ResponseEntity<>(new ErrorResponse("Failed to schedule meeting: " + e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping
    public ResponseEntity<List<Meeting>> getAllMeetings() {
        List<Meeting> meetings = meetingService.getAllMeetings();
        return new ResponseEntity<>(meetings, HttpStatus.OK);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Object> getMeetingById(@PathVariable String id) {
        Optional<Meeting> meeting = meetingService.getMeetingById(id);
        return meeting
                .<ResponseEntity<Object>>map(value -> new ResponseEntity<>(value, HttpStatus.OK))
                .orElseGet(() -> new ResponseEntity<>(new ErrorResponse("Meeting not found with ID: " + id), HttpStatus.NOT_FOUND));
    }

    // ✅ PUT method for updating meetings - Fixed date parsing
    @PutMapping("/{id}")
    public ResponseEntity<Object> updateMeeting(
            @PathVariable String id,
            @RequestBody Map<String, Object> updates) {
        try {
            System.out.println("🔄 Updating meeting with ID: " + id);
            System.out.println("📤 Update data: " + updates);
            
            // ✅ Check if meeting exists
            Optional<Meeting> existingMeetingOpt = meetingService.getMeetingById(id);
            if (!existingMeetingOpt.isPresent()) {
                System.out.println("❌ Meeting not found with ID: " + id);
                return new ResponseEntity<>(new ErrorResponse("Meeting not found with ID: " + id), HttpStatus.NOT_FOUND);
            }

            Meeting existingMeeting = existingMeetingOpt.get();
            System.out.println("📝 Found meeting: " + existingMeeting.getTitle());
            
            // ✅ Update fields from the map
            if (updates.containsKey("title")) {
                existingMeeting.setTitle((String) updates.get("title"));
            }
            if (updates.containsKey("agenda")) {
                existingMeeting.setAgenda((String) updates.get("agenda"));
            }
            if (updates.containsKey("meetingDate")) {
                LocalDate date = parseLocalDate(updates.get("meetingDate"));
                if (date != null) {
                    existingMeeting.setMeetingDate(date);
                }
            }
            if (updates.containsKey("meetingTime")) {
                LocalTime time = parseLocalTime(updates.get("meetingTime"));
                if (time != null) {
                    existingMeeting.setMeetingTime(time);
                }
            }
            if (updates.containsKey("meetingLink")) {
                existingMeeting.setMeetingLink((String) updates.get("meetingLink"));
            }
            if (updates.containsKey("calledByRole")) {
                existingMeeting.setCalledByRole((String) updates.get("calledByRole"));
            }
            if (updates.containsKey("targetAudience")) {
                existingMeeting.setTargetAudience((String) updates.get("targetAudience"));
            }
            if (updates.containsKey("modifiedBy")) {
                existingMeeting.setModifiedBy((String) updates.get("modifiedBy"));
            }
            if (updates.containsKey("modifiedOn")) {
                LocalDateTime modifiedOn = parseLocalDateTime(updates.get("modifiedOn"));
                if (modifiedOn != null) {
                    existingMeeting.setModifiedOn(modifiedOn);
                }
            }
            if (updates.containsKey("mansoftTenantId")) {
                existingMeeting.setMansoftTenantId((String) updates.get("mansoftTenantId"));
            }

            // ✅ Save updated meeting
            Meeting saved = meetingService.saveMeeting(existingMeeting);
            System.out.println("✅ Meeting updated successfully: " + saved.getId());
            return new ResponseEntity<>(saved, HttpStatus.OK);

        } catch (IllegalArgumentException e) {
            return new ResponseEntity<>(new ErrorResponse(e.getMessage()), HttpStatus.BAD_REQUEST);
        } catch (Exception e) {
            System.err.println("❌ Error updating meeting: " + e.getMessage());
            e.printStackTrace();
            return new ResponseEntity<>(new ErrorResponse("Failed to update meeting: " + e.getMessage()), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @DeleteMapping("/{id}")
public ResponseEntity<Object> deleteMeeting(@PathVariable String id) {
    try {
        System.out.println("🗑️ DELETE request received for meeting ID: " + id);
        
        // ✅ Check if meeting exists
        Optional<Meeting> existingMeeting = meetingService.getMeetingById(id);
        if (!existingMeeting.isPresent()) {
            System.out.println("❌ Meeting not found with ID: " + id);
            return new ResponseEntity<>(
                new ErrorResponse("Meeting not found with ID: " + id), 
                HttpStatus.NOT_FOUND
            );
        }

        String meetingTitle = existingMeeting.get().getTitle();
        System.out.println("📝 Found meeting: " + meetingTitle);
        
        // ✅ Delete the meeting
        meetingService.deleteMeeting(id);
        System.out.println("✅ Meeting deleted successfully");
        
        // ✅ Return 200 OK with success message (matching Swagger spec)
        return new ResponseEntity<>(
            new ErrorResponse("Meeting '" + meetingTitle + "' deleted successfully"), 
            HttpStatus.OK
        );
        
    } catch (Exception e) {
        System.err.println("❌ Error deleting meeting: " + e.getMessage());
        e.printStackTrace();
        return new ResponseEntity<>(
            new ErrorResponse("Failed to delete meeting: " + e.getMessage()), 
            HttpStatus.INTERNAL_SERVER_ERROR
        );
    }
}
}