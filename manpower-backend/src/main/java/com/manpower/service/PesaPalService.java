package com.manpower.service;

import com.manpower.dto.PesaPalInitiateRequest;
import com.manpower.dto.PesaPalInitiateResponse;

// Interface for PesaPal payment operations
public interface PesaPalService {
    PesaPalInitiateResponse initiatePayment(PesaPalInitiateRequest request);
    String checkPaymentStatus(String orderTrackingId);
    // You might add methods for webhook handling here later
}
