package com.manpower.service;

import com.manpower.entity.Meeting;

import java.util.List;
import java.util.Optional;

public interface MeetingService {
    List<Meeting> getAllMeetings();
    Optional<Meeting> getMeetingById(String id);
    Meeting saveMeeting(Meeting meeting);
    void deleteMeeting(String id);
}
