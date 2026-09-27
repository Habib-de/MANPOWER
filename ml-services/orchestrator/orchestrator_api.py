# orchestrator_api_v8_fixed_columns.py - WITH PER-APPLICATION RISK PRICING + ML REPAYMENT TERM
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
import pandas as pd
import numpy as np
import joblib
import mysql.connector
from typing import Dict, Any, List
from datetime import datetime, timedelta
import logging
import re
from scipy.sparse import hstack, csr_matrix

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Setup paths ---
base_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(base_dir, ".."))
sys.path.append(project_root)

# --- Database Configuration ---
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD', ''),
    'database': os.getenv('DB_NAME', 'manpower2_db'),
    'port': int(os.getenv('DB_PORT', 3306)),
    'autocommit': True
}

# =============================================================================
# LOAD YOUR TRAINED ML MODELS
# =============================================================================

print("\n" + "="*70)
print("🧠 LOADING YOUR TRAINED ML MODELS")
print("="*70)

ELIGIBILITY_MODEL = None
ELIGIBILITY_SCALER = None
ELIGIBILITY_FEATURES = []

try:
    eligibility_path = os.path.join(project_root, "loan-eligibility-predictor", "models", "loan_eligibility_model.joblib")
    if os.path.exists(eligibility_path):
        eligibility_data = joblib.load(eligibility_path)
        ELIGIBILITY_MODEL = eligibility_data['model']
        
        if 'scaler' in eligibility_data and eligibility_data['scaler'] is not None:
            ELIGIBILITY_SCALER = eligibility_data['scaler']
        else:
            from sklearn.preprocessing import StandardScaler
            ELIGIBILITY_SCALER = StandardScaler()
            dummy_data = np.zeros((10, len(eligibility_data.get('feature_names', []))))
            ELIGIBILITY_SCALER.fit(dummy_data)
        
        ELIGIBILITY_FEATURES = eligibility_data.get('feature_names', [
            'membership_months', 'is_active', 'contribution_count', 
            'avg_contribution', 'total_contributed', 'completion_rate',
            'loan_count', 'avg_loan_amount', 'repayment_rate', 'avg_outstanding'
        ])
        print(f"✅ Eligibility Model loaded: {type(ELIGIBILITY_MODEL).__name__}")
        print(f"   Features: {len(ELIGIBILITY_FEATURES)}")
except Exception as e:
    print(f"❌ Eligibility Model failed: {e}")

RISK_MODEL = None
RISK_SCALER = None
RISK_FEATURES = []

try:
    risk_path = os.path.join(project_root, "loan-risk-predictor", "models", "risk_predictor.joblib")
    if os.path.exists(risk_path):
        risk_data = joblib.load(risk_path)
        RISK_MODEL = risk_data['model']
        RISK_SCALER = risk_data['scaler']
        RISK_FEATURES = risk_data.get('feature_columns', [
            'membership_months', 'is_active', 'loan_count', 'avg_loan_amount', 
            'max_loan_amount', 'avg_interest_rate', 'avg_outstanding', 
            'repayment_rate', 'has_loan_history', 'loan_to_capacity_ratio'
        ])
        print(f"✅ Risk Model loaded: {type(RISK_MODEL).__name__}")
        print(f"   Features: {len(RISK_FEATURES)}")
except Exception as e:
    print(f"❌ Risk Model failed: {e}")

SENTIMENT_MODEL = None
SENTIMENT_VECTORIZER = None
SENTIMENT_SIA = None
SENTIMENT_CHANNELS = []

try:
    sentiment_path = os.path.join(project_root, "sentiment-analyzer", "models", "sentiment_analyzer.joblib")
    if os.path.exists(sentiment_path):
        sentiment_data = joblib.load(sentiment_path)
        SENTIMENT_MODEL = sentiment_data['model']
        SENTIMENT_VECTORIZER = sentiment_data['vectorizer']
        SENTIMENT_SIA = sentiment_data.get('sia')
        SENTIMENT_CHANNELS = sentiment_data.get('channel_names', [])
        if not SENTIMENT_CHANNELS:
            SENTIMENT_CHANNELS = ['Email', 'Meeting', 'Mobile App', 'SMS', 'WhatsApp']
        print(f"✅ Sentiment Model loaded: {type(SENTIMENT_MODEL).__name__}")
        print(f"   Channels: {SENTIMENT_CHANNELS}")
except Exception as e:
    print(f"❌ Sentiment Model failed: {e}")

ML_MODELS_READY = all([ELIGIBILITY_MODEL, RISK_MODEL, SENTIMENT_MODEL])
print(f"\n{'🎯 ALL MODELS LOADED!' if ML_MODELS_READY else '⚠️ Some models unavailable'}")
print("="*70)

# =============================================================================
# DATABASE FETCHER - WITH CORRECT SNAKE_CASE COLUMN NAMES
# =============================================================================

class DatabaseFetcher:
    def __init__(self, config=DB_CONFIG):
        self.config = config
    
    def get_connection(self):
        """Create a NEW connection each time (thread-safe)"""
        try:
            connection = mysql.connector.connect(**self.config)
            return connection
        except Exception as e:
            logger.error(f"Database connection failed: {e}")
            return None
    
    def fetch_member_data(self, member_id: str) -> Dict:
        """
        Fetch member data INCLUDING pending contributions, overdue status,
        penalties, and contribution discipline metrics.
        Uses CORRECT snake_case column names: due_date, payment_date, 
        penalty_applied, is_late, days_late, transaction_date
        """
        conn = self.get_connection()
        if not conn:
            return self._get_empty_data()
        
        cursor = None
        try:
            cursor = conn.cursor(dictionary=True)
            
            # 1. Get member basic info
            cursor.execute("""
                SELECT 
                    id, first_name, last_name, email, phone_number,
                    role, status, join_date,
                    DATEDIFF(NOW(), join_date) as membership_days
                FROM members 
                WHERE id = %s
            """, (member_id,))
            member = cursor.fetchone()
            
            if not member:
                logger.warning(f"Member {member_id} not found")
                return self._get_empty_data()
            
            # Calculate membership
            join_date = member.get('join_date')
            membership_days = member.get('membership_days')
            
            if (not join_date or join_date == '0000-00-00' or 
                join_date == 'NULL' or membership_days is None or membership_days < 0):
                membership_days = 0
                membership_months = 0.0
            else:
                membership_days = max(0, membership_days)
                membership_months = membership_days / 30.44
            
            member_info = {
                'id': member['id'],
                'first_name': member.get('first_name', ''),
                'last_name': member.get('last_name', ''),
                'email': member.get('email', ''),
                'phone_number': member.get('phone_number', ''),
                'role': member.get('role', 'Member'),
                'status': member.get('status', 'Unknown'),
                'join_date': join_date if join_date and join_date != 'NULL' else None,
                'membership_days': membership_days,
                'membership_months': membership_months
            }
            
            logger.info(f"🔍 Member: {member.get('first_name')} {member.get('last_name')}")
            logger.info(f"   Membership: {membership_months:.1f} months | Status: {member.get('status')}")
            
            # 2. Get contributions with PENDING, OVERDUE, PENALTY tracking
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_count,
                    COUNT(CASE WHEN status = 'Completed' THEN 1 END) as completed_count,
                    COUNT(CASE WHEN status = 'Pending' THEN 1 END) as pending_count,
                    COUNT(CASE WHEN status = 'Pending' AND due_date < NOW() THEN 1 END) as overdue_count,
                    COUNT(CASE WHEN status = 'Pending' AND due_date < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as severely_overdue_count,
                    COUNT(CASE WHEN status = 'Overdue' THEN 1 END) as marked_overdue_count,
                    COUNT(CASE WHEN is_late = 1 THEN 1 END) as marked_late_count,
                    COALESCE(AVG(amount), 0) as avg_amount,
                    COALESCE(SUM(amount), 0) as total_amount,
                    COALESCE(SUM(CASE WHEN status = 'Completed' THEN amount ELSE 0 END), 0) as total_completed,
                    COALESCE(SUM(CASE WHEN status = 'Pending' THEN amount ELSE 0 END), 0) as total_pending,
                    COALESCE(SUM(CASE WHEN status = 'Pending' AND due_date < NOW() THEN amount ELSE 0 END), 0) as total_overdue,
                    COALESCE(SUM(CASE WHEN status = 'Overdue' THEN amount ELSE 0 END), 0) as total_marked_overdue,
                    COALESCE(SUM(penalty_applied), 0) as total_penalties,
                    COALESCE(AVG(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END), 0) as completion_rate,
                    MAX(transaction_date) as last_contribution_date,
                    COALESCE(
                        DATEDIFF(NOW(), MAX(CASE WHEN status = 'Completed' THEN transaction_date END)),
                        999
                    ) as days_since_last_contribution,
                    COUNT(CASE WHEN payment_date > due_date AND status = 'Completed' THEN 1 END) as late_payment_count,
                    COALESCE(
                        AVG(CASE WHEN payment_date > due_date AND status = 'Completed' 
                            THEN DATEDIFF(payment_date, due_date) ELSE 0 END),
                        0
                    ) as avg_days_late
                FROM contributions 
                WHERE member_id = %s
            """, (member_id,))
            contribs = cursor.fetchone()
            
            contributions = {
                'total_count': int(contribs['total_count']) if contribs else 0,
                'completed_count': int(contribs['completed_count']) if contribs else 0,
                'pending_count': int(contribs['pending_count']) if contribs else 0,
                'overdue_count': int(contribs['overdue_count']) if contribs else 0,
                'severely_overdue_count': int(contribs['severely_overdue_count']) if contribs else 0,
                'marked_overdue_count': int(contribs['marked_overdue_count']) if contribs else 0,
                'marked_late_count': int(contribs['marked_late_count']) if contribs else 0,
                'avg_amount': float(contribs['avg_amount']) if contribs else 0.0,
                'total_amount': float(contribs['total_amount']) if contribs else 0.0,
                'total_completed': float(contribs['total_completed']) if contribs else 0.0,
                'total_pending': float(contribs['total_pending']) if contribs else 0.0,
                'total_overdue': float(contribs['total_overdue']) if contribs else 0.0,
                'total_marked_overdue': float(contribs['total_marked_overdue']) if contribs else 0.0,
                'total_penalties': float(contribs['total_penalties']) if contribs else 0.0,
                'completion_rate': float(contribs['completion_rate']) if contribs else 0.0,
                'last_contribution_date': contribs['last_contribution_date'] if contribs else None,
                'days_since_last_contribution': int(contribs['days_since_last_contribution']) if contribs else 999,
                'late_payment_count': int(contribs['late_payment_count']) if contribs else 0,
                'avg_days_late': float(contribs['avg_days_late']) if contribs else 0.0,
                # Legacy fields for backward compatibility
                'count': int(contribs['total_count']) if contribs else 0,
                'total': float(contribs['total_completed']) if contribs else 0.0,
            }
            
            logger.info(f"   Contributions: {contributions['completed_count']} completed, "
                       f"{contributions['pending_count']} pending, "
                       f"{contributions['overdue_count']} overdue")
            logger.info(f"   Penalties: KES {contributions['total_penalties']:,.0f}")
            logger.info(f"   Days since last: {contributions['days_since_last_contribution']}")
            
            # 3. Get loans
            cursor.execute("""
                SELECT 
                    COUNT(*) as count, 
                    COALESCE(AVG(amount), 0) as avg_amount, 
                    COALESCE(MAX(amount), 0) as max_amount, 
                    COALESCE(AVG(interest_rate), 0) as avg_interest,
                    COALESCE(AVG(outstanding_balance), 0) as avg_outstanding,
                    COALESCE(SUM(outstanding_balance), 0) as total_outstanding,
                    COALESCE(AVG(CASE WHEN status = 'Repaid' THEN 1 ELSE 0 END), 0) as repayment_rate,
                    COUNT(CASE WHEN status = 'Defaulted' THEN 1 END) as defaulted_count,
                    COUNT(CASE WHEN status = 'Overdue' THEN 1 END) as overdue_loan_count,
                    COUNT(CASE WHEN status = 'Active' THEN 1 END) as active_loan_count
                FROM loans 
                WHERE member_id = %s
            """, (member_id,))
            loans = cursor.fetchone()
            
            loan_data = {
                'count': int(loans['count']) if loans else 0,
                'avg_amount': float(loans['avg_amount']) if loans else 0.0,
                'max_amount': float(loans['max_amount']) if loans else 0.0,
                'avg_interest': float(loans['avg_interest']) if loans else 0.0,
                'avg_outstanding': float(loans['avg_outstanding']) if loans else 0.0,
                'total_outstanding': float(loans['total_outstanding']) if loans else 0.0,
                'repayment_rate': float(loans['repayment_rate']) if loans else 0.0,
                'defaulted_count': int(loans['defaulted_count']) if loans else 0,
                'overdue_loan_count': int(loans['overdue_loan_count']) if loans else 0,
                'active_loan_count': int(loans['active_loan_count']) if loans else 0
            }
            
            logger.info(f"   Loans: {loan_data['count']} total, "
                       f"{loan_data['active_loan_count']} active, "
                       f"{loan_data['defaulted_count']} defaulted")
            
            return {
                'member': member_info,
                'contributions': contributions,
                'loans': loan_data,
                'membership_months': membership_months
            }
            
        except Exception as e:
            logger.error(f"Error fetching data for {member_id}: {e}")
            logger.exception("Full traceback:")
            return self._get_empty_data()
        finally:
            if cursor:
                try:
                    cursor.close()
                except:
                    pass
            if conn:
                try:
                    conn.close()
                except:
                    pass
    
    def _get_empty_data(self):
        """Return empty data structure"""
        return {
            'member': {
                'id': '', 'first_name': '', 'last_name': '', 
                'email': '', 'phone_number': '', 'role': 'Member', 
                'status': 'Unknown', 'join_date': None, 
                'membership_days': 0, 'membership_months': 0.0
            },
            'contributions': {
                'total_count': 0, 'completed_count': 0, 'pending_count': 0,
                'overdue_count': 0, 'severely_overdue_count': 0, 'marked_overdue_count': 0,
                'marked_late_count': 0,
                'avg_amount': 0.0, 'total_amount': 0.0, 'total_completed': 0.0,
                'total_pending': 0.0, 'total_overdue': 0.0, 'total_marked_overdue': 0.0,
                'total_penalties': 0.0, 'completion_rate': 0.0,
                'last_contribution_date': None, 'days_since_last_contribution': 999,
                'late_payment_count': 0, 'avg_days_late': 0.0,
                'count': 0, 'total': 0.0
            },
            'loans': {
                'count': 0, 'avg_amount': 0.0, 'max_amount': 0.0,
                'avg_interest': 0.0, 'avg_outstanding': 0.0, 'total_outstanding': 0.0,
                'repayment_rate': 0.0, 'defaulted_count': 0, 'overdue_loan_count': 0,
                'active_loan_count': 0
            },
            'membership_months': 0.0
        }

# =============================================================================
# CONTRIBUTION DISCIPLINE SCORING - BALANCED
# =============================================================================

def calculate_contribution_discipline_score(contributions: Dict) -> Dict:
    """
    Calculate a contribution discipline score (0-100).
    BALANCED: Rewards good behavior, penalizes ONLY actual problems.
    """
    score = 70  # Start NEUTRAL
    bonuses = []
    deductions = []
    flags = []
    
    pending_count = contributions['pending_count']
    overdue_count = contributions['overdue_count']
    severely_overdue = contributions['severely_overdue_count']
    marked_overdue = contributions['marked_overdue_count']
    total_pending = contributions['total_pending']
    total_overdue = contributions['total_overdue']
    total_penalties = contributions['total_penalties']
    completion_rate = contributions['completion_rate']
    total_completed = contributions['total_completed']
    completed_count = contributions['completed_count']
    days_since_last = contributions['days_since_last_contribution']
    late_payment_count = contributions['late_payment_count']
    avg_days_late = contributions['avg_days_late']
    
    # ============ BONUSES - REWARD GOOD BEHAVIOR ============
    
    if completion_rate >= 0.9:
        bonus = 15
        score += bonus
        bonuses.append(f"Excellent completion rate ({completion_rate:.0%}): +{bonus}")
    elif completion_rate >= 0.8:
        bonus = 10
        score += bonus
        bonuses.append(f"Good completion rate ({completion_rate:.0%}): +{bonus}")
    elif completion_rate >= 0.7:
        bonus = 5
        score += bonus
        bonuses.append(f"Above average completion rate ({completion_rate:.0%}): +{bonus}")
    
    if total_completed > 50000:
        bonus = 10
        score += bonus
        bonuses.append(f"Strong savings record (KES {total_completed:,.0f}): +{bonus}")
    elif total_completed > 20000:
        bonus = 5
        score += bonus
        bonuses.append(f"Good savings record (KES {total_completed:,.0f}): +{bonus}")
    
    if completed_count > 12:
        bonus = 10
        score += bonus
        bonuses.append(f"Consistent contributor ({completed_count} contributions): +{bonus}")
    elif completed_count > 6:
        bonus = 5
        score += bonus
        bonuses.append(f"Regular contributor ({completed_count} contributions): +{bonus}")
    
    if days_since_last <= 30:
        bonus = 10
        score += bonus
        bonuses.append(f"Recent contribution ({days_since_last} days ago): +{bonus}")
    elif days_since_last <= 60:
        bonus = 5
        score += bonus
        bonuses.append(f"Active within 2 months ({days_since_last} days): +{bonus}")
    
    if late_payment_count == 0 and completed_count > 0:
        bonus = 5
        score += bonus
        bonuses.append("Always paid on time: +5")
    
    # ============ DEDUCTIONS - ONLY FOR ACTUAL PROBLEMS ============
    
    if pending_count > 0:
        deduction = min(15, pending_count * 5)
        score -= deduction
        deductions.append(f"Pending contributions ({pending_count}): -{deduction}")
        if pending_count >= 3:
            flags.append(f"Multiple pending contributions ({pending_count})")
    
    if overdue_count > 0:
        deduction = min(30, overdue_count * 10)
        score -= deduction
        deductions.append(f"Overdue contributions ({overdue_count}): -{deduction}")
        flags.append(f"HAS_OVERDUE_CONTRIBUTIONS ({overdue_count} overdue, KES {total_overdue:,.0f})")
    
    if severely_overdue > 0:
        deduction = min(25, severely_overdue * 15)
        score -= deduction
        deductions.append(f"Severely overdue 30+ days ({severely_overdue}): -{deduction}")
        flags.append(f"CRITICAL: Severely overdue contributions ({severely_overdue})")
    
    if marked_overdue > 0:
        deduction = min(20, marked_overdue * 10)
        score -= deduction
        deductions.append(f"System marked overdue ({marked_overdue}): -{deduction}")
        flags.append(f"System marked overdue: {marked_overdue} contributions")
    
    if total_penalties > 1000:
        deduction = min(15, int(total_penalties / 1000))
        score -= deduction
        deductions.append(f"Penalties (KES {total_penalties:,.0f}): -{deduction}")
        flags.append(f"Has accumulated penalties: KES {total_penalties:,.0f}")
    elif total_penalties > 100:
        deduction = 3
        score -= deduction
        deductions.append(f"Minor penalties (KES {total_penalties:,.0f}): -{deduction}")
    
    if completion_rate < 0.3:
        deduction = 20
        score -= deduction
        deductions.append(f"Very low completion rate ({completion_rate:.0%}): -{deduction}")
        flags.append(f"Very low contribution completion rate: {completion_rate:.0%}")
    elif completion_rate < 0.5:
        deduction = 10
        score -= deduction
        deductions.append(f"Low completion rate ({completion_rate:.0%}): -{deduction}")
    elif completion_rate < 0.6:
        deduction = 5
        score -= deduction
        deductions.append(f"Below average completion rate ({completion_rate:.0%}): -{deduction}")
    
    if days_since_last > 180:
        deduction = 20
        score -= deduction
        deductions.append(f"No contribution for {days_since_last} days (6+ months): -{deduction}")
        flags.append(f"CRITICAL: No contribution for {days_since_last} days")
    elif days_since_last > 90:
        deduction = 10
        score -= deduction
        deductions.append(f"No contribution for {days_since_last} days (3+ months): -{deduction}")
        flags.append(f"Warning: No contribution for {days_since_last} days")
    elif days_since_last > 60:
        deduction = 5
        score -= deduction
        deductions.append(f"No contribution for {days_since_last} days (2+ months): -{deduction}")
    
    if late_payment_count > 5:
        deduction = 15
        score -= deduction
        deductions.append(f"Chronic late payments ({late_payment_count}, avg {avg_days_late:.0f} days): -{deduction}")
        flags.append(f"Chronic late payer: {late_payment_count} late payments")
    elif late_payment_count > 3:
        deduction = 8
        score -= deduction
        deductions.append(f"Multiple late payments ({late_payment_count}): -{deduction}")
    elif late_payment_count > 0:
        deduction = 3
        score -= deduction
        deductions.append(f"Some late payments ({late_payment_count}): -{deduction}")
    
    score = max(0, min(100, score))
    
    if score >= 80:
        level = "EXCELLENT"
    elif score >= 65:
        level = "GOOD"
    elif score >= 50:
        level = "FAIR"
    elif score >= 35:
        level = "POOR"
    else:
        level = "CRITICAL"
    
    return {
        'score': score,
        'level': level,
        'bonuses': bonuses,
        'deductions': deductions,
        'flags': flags,
        'has_pending': pending_count > 0,
        'has_overdue': overdue_count > 0,
        'pending_count': pending_count,
        'overdue_count': overdue_count,
        'total_pending_amount': total_pending,
        'total_overdue_amount': total_overdue,
        'total_penalties': total_penalties
    }

# =============================================================================
# CONSERVATIVE LENDING MULTIPLIERS
# =============================================================================

def get_savings_multiplier(membership_months: float, discipline_score: float) -> float:
    """Savings multiplier adjusted by contribution discipline"""
    if membership_months < 3:
        base = 0.3
    elif membership_months < 6:
        base = 0.5
    elif membership_months < 12:
        base = 0.8
    elif membership_months < 24:
        base = 1.2
    elif membership_months < 36:
        base = 1.5
    else:
        base = 2.0
    
    if discipline_score >= 80:
        discipline_multiplier = 1.0
    elif discipline_score >= 65:
        discipline_multiplier = 0.85
    elif discipline_score >= 50:
        discipline_multiplier = 0.7
    elif discipline_score >= 35:
        discipline_multiplier = 0.5
    else:
        discipline_multiplier = 0.3
    
    return base * discipline_multiplier

# =============================================================================
# ML PREDICTION FUNCTIONS - CONTRIBUTION-AWARE
# =============================================================================

def predict_eligibility_with_model(member_data: Dict, discipline: Dict) -> Dict:
    """Use trained eligibility model with contribution discipline adjustments"""
    if not ELIGIBILITY_MODEL:
        return predict_eligibility_with_rules(member_data, discipline)
    
    try:
        membership_months = member_data['membership_months']
        status = member_data['member']['status']
        
        features = [
            membership_months,
            1 if status == 'Active' else 0,
            float(member_data['contributions']['count']),
            float(member_data['contributions']['avg_amount']),
            float(member_data['contributions']['total']),
            float(member_data['contributions']['completion_rate']),
            float(member_data['loans']['count']),
            float(member_data['loans']['avg_amount']),
            float(member_data['loans']['repayment_rate']),
            float(member_data['loans']['avg_outstanding'])
        ]
        
        X = np.array([features])
        
        if np.any(np.isnan(X)) or np.any(np.isinf(X)):
            return predict_eligibility_with_rules(member_data, discipline)
        
        try:
            if ELIGIBILITY_SCALER and hasattr(ELIGIBILITY_SCALER, 'mean_'):
                X_transformed = ELIGIBILITY_SCALER.transform(X)
            else:
                X_transformed = X
        except:
            X_transformed = X
        
        prediction = ELIGIBILITY_MODEL.predict(X_transformed)[0]
        
        if np.isnan(prediction) or np.isinf(prediction):
            return predict_eligibility_with_rules(member_data, discipline)
        
        prediction = float(np.clip(prediction, 5000, 150000))
        
        # Apply savings multiplier with discipline adjustment
        total_savings = member_data['contributions']['total']
        savings_multiplier = get_savings_multiplier(membership_months, discipline['score'])
        max_by_savings = total_savings * savings_multiplier
        prediction = min(prediction, max_by_savings)
        
        # Penalty for pending/overdue contributions
        if discipline['has_pending']:
            pending_total = discipline['total_pending_amount']
            prediction = max(0, prediction - (pending_total * 2))
        
        if discipline['has_overdue']:
            overdue_total = discipline['total_overdue_amount']
            prediction = max(0, prediction - (overdue_total * 3))
        
        # Discipline-based reduction
        discipline_multiplier = discipline['score'] / 100
        prediction *= discipline_multiplier
        
        # Caps for new members
        if membership_months < 3:
            prediction = min(prediction, 15000)
        elif membership_months < 6:
            prediction = min(prediction, 30000)
        
        prediction = max(0, prediction)
        
        # Confidence penalized by poor discipline
        base_confidence = min(0.9, 0.6 + (membership_months / 36))
        discipline_confidence_multiplier = max(0.3, discipline['score'] / 100)
        confidence = base_confidence * discipline_confidence_multiplier
        
        if membership_months < 3:
            confidence *= 0.5
        elif membership_months < 6:
            confidence *= 0.7
        
        logger.info(f"📊 ML Eligibility: KES {prediction:,.0f} (discipline: {discipline['score']}/100, conf: {confidence:.1%})")
        
        return {
            'amount': float(prediction),
            'confidence': float(confidence),
            'source': 'ml_model',
            'savings_multiplier': savings_multiplier,
            'discipline_score': discipline['score'],
            'discipline_flags': discipline['flags']
        }
        
    except Exception as e:
        logger.error(f"Eligibility model failed: {e}")
        return predict_eligibility_with_rules(member_data, discipline)

def predict_eligibility_with_rules(member_data: Dict, discipline: Dict) -> Dict:
    """Rule-based eligibility with contribution discipline"""
    membership_months = member_data['membership_months']
    status = member_data['member']['status']
    total_savings = member_data['contributions']['total']
    
    if discipline['level'] == 'CRITICAL':
        return {
            'amount': 0.0,
            'confidence': 0.95,
            'source': 'rules',
            'reason': f"Critical contribution delinquency: {', '.join(discipline['flags'])}",
            'discipline_score': discipline['score'],
            'discipline_flags': discipline['flags']
        }
    
    if discipline['has_overdue'] and discipline['overdue_count'] >= 3:
        return {
            'amount': 0.0,
            'confidence': 0.9,
            'source': 'rules',
            'reason': f"Multiple overdue contributions ({discipline['overdue_count']})",
            'discipline_score': discipline['score'],
            'discipline_flags': discipline['flags']
        }
    
    if status != 'Active':
        amount = 0
    else:
        multiplier = get_savings_multiplier(membership_months, discipline['score'])
        amount = total_savings * multiplier
    
    amount *= (discipline['score'] / 100)
    
    if discipline['has_pending']:
        amount = max(0, amount - discipline['total_pending_amount'])
    if discipline['has_overdue']:
        amount = max(0, amount - discipline['total_overdue_amount'] * 1.5)
    
    if membership_months < 3:
        amount = min(amount, 10000)
    elif membership_months < 6:
        amount = min(amount, 20000)
    elif membership_months < 12:
        amount = min(amount, 50000)
    else:
        amount = min(amount, 150000)
    
    amount = max(0, amount)
    
    return {
        'amount': float(amount),
        'confidence': max(0.3, discipline['score'] / 200),
        'source': 'rules',
        'discipline_score': discipline['score'],
        'discipline_flags': discipline['flags']
    }

def predict_risk_with_model(member_data: Dict, discipline: Dict) -> Dict:
    """Use trained risk model with contribution discipline overlay"""
    if not RISK_MODEL:
        return predict_risk_with_rules(member_data, discipline)
    
    try:
        membership_months = member_data['membership_months']
        
        avg_loan = float(member_data['loans']['avg_amount'] or 1)
        total_contrib = float(member_data['contributions']['total_completed'] or 1)
        capacity_ratio = avg_loan / total_contrib if total_contrib > 0 else 0
        
        features = [
            membership_months,
            1 if member_data['member']['status'] == 'Active' else 0,
            float(member_data['loans']['count']),
            float(member_data['loans']['avg_amount']),
            float(member_data['loans']['max_amount']),
            float(member_data['loans']['avg_interest']),
            float(member_data['loans']['avg_outstanding']),
            float(member_data['loans']['repayment_rate']),
            1 if member_data['loans']['count'] > 0 else 0,
            capacity_ratio
        ]
        
        X = np.array([features])
        
        if np.any(np.isnan(X)) or np.any(np.isinf(X)):
            return predict_risk_with_rules(member_data, discipline)
        
        X_scaled = RISK_SCALER.transform(X)
        probability = RISK_MODEL.predict_proba(X_scaled)[0][1]
        
        # Discipline risk boost
        discipline_risk_boost = 0.0
        
        if discipline['has_overdue']:
            discipline_risk_boost += 0.3
            logger.info(f"⚠️ Risk boosted +30% due to overdue contributions")
        elif discipline['has_pending']:
            discipline_risk_boost += 0.15
        
        if discipline['score'] < 35:
            discipline_risk_boost += 0.25
        elif discipline['score'] < 50:
            discipline_risk_boost += 0.15
        elif discipline['score'] < 65:
            discipline_risk_boost += 0.05
        
        probability = min(0.98, probability + discipline_risk_boost)
        
        # New member risk increase
        if membership_months < 3:
            probability = min(0.95, probability * 1.5)
        elif membership_months < 6:
            probability = min(0.90, probability * 1.3)
        
        # Convert to risk level
        if probability < 0.15:
            level = "VERY LOW"
        elif probability < 0.30:
            level = "LOW"
        elif probability < 0.50:
            level = "MEDIUM"
        elif probability < 0.70:
            level = "HIGH"
        else:
            level = "VERY HIGH"
        
        if discipline['level'] == 'CRITICAL':
            level = "VERY HIGH"
            probability = max(probability, 0.85)
        
        base_confidence = max(RISK_MODEL.predict_proba(X_scaled)[0])
        discipline_conf_mult = max(0.3, discipline['score'] / 100)
        confidence = base_confidence * discipline_conf_mult
        
        return {
            'probability': float(probability),
            'level': level,
            'confidence': float(confidence),
            'source': 'ml_model',
            'discipline_risk_boost': discipline_risk_boost
        }
        
    except Exception as e:
        logger.error(f"Risk model failed: {e}")
        return predict_risk_with_rules(member_data, discipline)

def predict_risk_with_rules(member_data: Dict, discipline: Dict) -> Dict:
    """Rule-based risk with contribution discipline"""
    status = member_data['member']['status']
    membership_months = member_data['membership_months']
    loan_count = member_data['loans']['count']
    total_outstanding = member_data['loans']['total_outstanding']
    total_savings = member_data['contributions']['total_completed']
    
    if discipline['score'] >= 80:
        risk_score = 0.2
    elif discipline['score'] >= 65:
        risk_score = 0.3
    elif discipline['score'] >= 50:
        risk_score = 0.45
    elif discipline['score'] >= 35:
        risk_score = 0.65
    else:
        risk_score = 0.85
    
    if status != 'Active':
        risk_score += 0.2
    
    if membership_months < 3:
        risk_score += 0.2
    elif membership_months < 6:
        risk_score += 0.1
    
    if discipline['has_overdue']:
        risk_score += 0.25
    elif discipline['has_pending']:
        risk_score += 0.1
    
    if loan_count > 3:
        risk_score += 0.15
    
    if total_savings > 0:
        debt_ratio = total_outstanding / total_savings
        if debt_ratio > 0.5:
            risk_score += 0.15
    
    risk_score = max(0.05, min(0.98, risk_score))
    
    if risk_score < 0.2:
        level = "VERY LOW"
    elif risk_score < 0.4:
        level = "LOW"
    elif risk_score < 0.6:
        level = "MEDIUM"
    elif risk_score < 0.8:
        level = "HIGH"
    else:
        level = "VERY HIGH"
    
    return {
        'probability': float(risk_score),
        'level': level,
        'confidence': max(0.3, discipline['score'] / 200),
        'source': 'rules',
        'discipline_risk_boost': 0.0
    }

def predict_sentiment_with_model(loan_purpose: str, channel: str = 'application') -> Dict:
    """Use trained sentiment model"""
    if not SENTIMENT_MODEL:
        return predict_sentiment_with_rules(loan_purpose)
    
    try:
        def preprocess_text(text):
            text = str(text).lower()
            text = re.sub(r'[^\w\s]', ' ', text)
            text = re.sub(r'\s+', ' ', text).strip()
            return text if text else "no content"
        
        cleaned_text = preprocess_text(loan_purpose)
        
        if SENTIMENT_SIA:
            vader_scores = SENTIMENT_SIA.polarity_scores(cleaned_text)
        else:
            from nltk.sentiment import SentimentIntensityAnalyzer
            sia = SentimentIntensityAnalyzer()
            vader_scores = sia.polarity_scores(cleaned_text)
        
        tfidf_features = SENTIMENT_VECTORIZER.transform([cleaned_text])
        
        additional_features = [
            len(cleaned_text),
            len(cleaned_text.split()),
            vader_scores['compound'],
            vader_scores['pos'],
            vader_scores['neg'],
            vader_scores['neu']
        ]
        
        for ch in sorted(SENTIMENT_CHANNELS):
            additional_features.append(1.0 if str(channel).strip().lower() == str(ch).strip().lower() else 0.0)
        
        additional_sparse = csr_matrix([additional_features])
        X = hstack([tfidf_features, additional_sparse])
        
        expected_features = SENTIMENT_MODEL.n_features_in_
        if X.shape[1] > expected_features:
            X = X[:, :expected_features]
        elif X.shape[1] < expected_features:
            padding = csr_matrix((1, expected_features - X.shape[1]))
            X = hstack([X, padding])
        
        prediction = SENTIMENT_MODEL.predict(X)[0]
        probabilities = SENTIMENT_MODEL.predict_proba(X)[0]
        confidence = float(max(probabilities))
        
        return {
            'risk': prediction,
            'confidence': confidence,
            'vader_score': vader_scores['compound'],
            'source': 'ml_model'
        }
        
    except Exception as e:
        logger.error(f"Sentiment model failed: {e}")
        return predict_sentiment_with_rules(loan_purpose)

def predict_sentiment_with_rules(loan_purpose: str) -> Dict:
    """Rule-based sentiment"""
    text_lower = loan_purpose.lower()
    
    low_keywords = ['business', 'investment', 'education', 'farm', 'equipment', 
                   'expansion', 'construction', 'stock', 'inventory', 'agriculture',
                   'development', 'capital', 'machine', 'vehicle']
    
    high_keywords = ['emergency', 'medical', 'funeral', 'debt', 'wedding', 
                    'personal', 'urgent', 'crisis', 'hospital', 'sickness',
                    'burial', 'loan repayment', 'pay debt']
    
    low_count = sum(1 for word in low_keywords if word in text_lower)
    high_count = sum(1 for word in high_keywords if word in text_lower)
    
    if low_count > high_count:
        return {'risk': 'LOW', 'confidence': min(0.8, 0.5 + low_count * 0.1), 'source': 'rules'}
    elif high_count > low_count:
        return {'risk': 'HIGH', 'confidence': min(0.8, 0.5 + high_count * 0.1), 'source': 'rules'}
    else:
        return {'risk': 'MEDIUM', 'confidence': 0.5, 'source': 'rules'}

# =============================================================================
# ML REPAYMENT TERM PREDICTION - NEW FUNCTION
# =============================================================================

def predict_repayment_term(risk_level: str, discipline_score: float, 
                           membership_months: float, loan_amount: float,
                           requested_amount: float, eligible_amount: float) -> Dict:
    """
    Predict the optimal repayment term in months based on member's risk profile.
    This is ML-based best practice - personalized loan terms.
    """
    
    # Start with risk-based base term
    risk_terms = {
        'VERY LOW': 24,   # Excellent members get longer terms
        'LOW': 18,
        'MEDIUM': 12,
        'HIGH': 6,
        'VERY HIGH': 3
    }
    term = risk_terms.get(risk_level, 12)
    
    breakdown = []
    breakdown.append(f"Base term for {risk_level} risk: {term} months")
    
    # Adjust by discipline score
    if discipline_score >= 85:
        term += 6
        breakdown.append(f"Excellent discipline ({discipline_score}/100): +6 months")
    elif discipline_score >= 70:
        term += 3
        breakdown.append(f"Good discipline ({discipline_score}/100): +3 months")
    elif discipline_score <= 40:
        term -= 3
        breakdown.append(f"Poor discipline ({discipline_score}/100): -3 months")
    elif discipline_score <= 30:
        term -= 6
        breakdown.append(f"Critical discipline ({discipline_score}/100): -6 months")
    
    # Adjust by membership tenure (loyalty)
    if membership_months >= 36:
        term += 6
        breakdown.append(f"3+ years member: +6 months")
    elif membership_months >= 24:
        term += 3
        breakdown.append(f"2+ years member: +3 months")
    elif membership_months >= 12:
        term += 1
        breakdown.append(f"1+ year member: +1 month")
    elif membership_months < 6:
        term = min(term, 6)
        breakdown.append(f"New member (<6 months): capped at 6 months")
    
    # Adjust by loan amount relative to eligibility (usage percentage)
    if eligible_amount > 0:
        usage_pct = requested_amount / eligible_amount
        if usage_pct > 0.8:
            term = max(3, term - 3)
            breakdown.append(f"High usage ({usage_pct:.0%} of limit): -3 months (higher risk)")
        elif usage_pct < 0.4:
            term = min(24, term + 3)
            breakdown.append(f"Conservative usage ({usage_pct:.0%} of limit): +3 months (lower risk)")
    
    # Adjust by loan amount size
    if loan_amount > 100000:
        term += 6
        breakdown.append(f"Large loan (KES {loan_amount:,.0f}): +6 months needed")
    elif loan_amount > 50000:
        term += 3
        breakdown.append(f"Medium loan (KES {loan_amount:,.0f}): +3 months")
    elif loan_amount < 10000:
        term = min(term, 6)
        breakdown.append(f"Small loan (<KES 10,000): capped at 6 months")
    
    # Clamp to realistic range (3-24 months)
    original_term = term
    term = max(3, min(24, term))
    if term != original_term:
        breakdown.append(f"Adjusted to {term} months (SACCO policy range 3-24 months)")
    
    # Round to common term values
    if term <= 3:
        final_term = 3
    elif term <= 6:
        final_term = 6
    elif term <= 12:
        final_term = 12
    elif term <= 18:
        final_term = 18
    elif term <= 24:
        final_term = 24
    else:
        final_term = 24
    
    if final_term != term:
        breakdown.append(f"Rounded to standard term: {final_term} months")
    
    logger.info(f"📅 Repayment term prediction:")
    for line in breakdown:
        logger.info(f"   {line}")
    
    return {
        'recommended_months': final_term,
        'breakdown': breakdown,
        'min_months': 3,
        'max_months': 24,
        'allow_custom': True  # Allow member to choose within range
    }

# =============================================================================
# PER-APPLICATION INTEREST RATE CALCULATOR - WITH FULL BREAKDOWN
# =============================================================================

def calculate_interest_rate(risk_level: str, loan_amount: float, eligible_amount: float, 
                           membership_months: float, repayment_rate: float = 0.0, 
                           discipline_score: float = 100) -> Dict:
    """
    Calculate PER-APPLICATION interest rate with SIMPLE, EXPLAINABLE rules.
    Returns both the rate AND the breakdown so members understand why.
    """
    
    # ============================================================
    # TIER 1: BASE RATE BY RISK LEVEL (Documented in SACCO policy)
    # ============================================================
    risk_base_rates = {
        'VERY LOW': 7.0,   # Excellent members
        'LOW': 9.0,        # Good members
        'MEDIUM': 12.0,    # Average members
        'HIGH': 15.0,      # Risky members
        'VERY HIGH': 18.0  # Very risky members
    }
    
    base_rate = risk_base_rates.get(risk_level, 12.0)
    breakdown = [f"Base rate for {risk_level} risk: {base_rate}%"]
    
    # ============================================================
    # TIER 2: LOAD-TO-ELIGIBILITY ADJUSTMENT (Simple tiers)
    # ============================================================
    if eligible_amount > 0:
        usage_percentage = loan_amount / eligible_amount
    else:
        usage_percentage = 0
    
    usage_adjustment = 0
    usage_tier = ""
    
    if usage_percentage >= 0.95:
        usage_adjustment = 3.0
        usage_tier = "Maximum utilization (>95%) +3.0%"
    elif usage_percentage >= 0.80:
        usage_adjustment = 2.0
        usage_tier = "High utilization (80-95%) +2.0%"
    elif usage_percentage >= 0.60:
        usage_adjustment = 1.0
        usage_tier = "Moderate utilization (60-80%) +1.0%"
    elif usage_percentage >= 0.40:
        usage_adjustment = 0.0
        usage_tier = "Standard utilization (40-60%) no adjustment"
    elif usage_percentage >= 0.20:
        usage_adjustment = -0.5
        usage_tier = "Conservative utilization (20-40%) -0.5%"
    else:
        usage_adjustment = -1.0
        usage_tier = "Very conservative utilization (<20%) -1.0%"
    
    if usage_tier:
        breakdown.append(usage_tier)
    
    # ============================================================
    # TIER 3: MEMBERSHIP DISCOUNT (Loyalty reward)
    # ============================================================
    if membership_months >= 36:
        tenure_discount = -1.0
        breakdown.append("3+ years member loyalty discount: -1.0%")
    elif membership_months >= 24:
        tenure_discount = -0.75
        breakdown.append("2-3 years member loyalty discount: -0.75%")
    elif membership_months >= 12:
        tenure_discount = -0.5
        breakdown.append("1-2 years member discount: -0.5%")
    elif membership_months >= 6:
        tenure_discount = -0.25
        breakdown.append("6-12 months member discount: -0.25%")
    else:
        tenure_discount = 0.0
    
    # ============================================================
    # TIER 4: REPAYMENT HISTORY DISCOUNT (Proven behavior)
    # ============================================================
    if repayment_rate >= 0.95:
        repayment_discount = -1.0
        breakdown.append("Excellent repayment history (95%+): -1.0%")
    elif repayment_rate >= 0.90:
        repayment_discount = -0.5
        breakdown.append("Very good repayment history (90-95%): -0.5%")
    elif repayment_rate >= 0.80:
        repayment_discount = 0.0
    elif repayment_rate >= 0.70:
        repayment_discount = 1.0
        breakdown.append("Below average repayment (70-80%): +1.0%")
    else:
        repayment_discount = 2.0
        breakdown.append("Poor repayment history (<70%): +2.0%")
    
    # ============================================================
    # TIER 5: CONTRIBUTION DISCIPLINE ADJUSTMENT
    # ============================================================
    if discipline_score >= 85:
        discipline_adjustment = -1.0
        breakdown.append("Excellent contribution discipline (85+): -1.0%")
    elif discipline_score >= 70:
        discipline_adjustment = -0.5
        breakdown.append("Good contribution discipline (70-85): -0.5%")
    elif discipline_score >= 55:
        discipline_adjustment = 0.0
    elif discipline_score >= 40:
        discipline_adjustment = 1.0
        breakdown.append("Fair contribution discipline (40-55): +1.0%")
    else:
        discipline_adjustment = 2.5
        breakdown.append("Poor contribution discipline (<40): +2.5%")
    
    # ============================================================
    # FINAL CALCULATION
    # ============================================================
    final_rate = base_rate + usage_adjustment + tenure_discount + repayment_discount + discipline_adjustment
    
    # Apply hard caps (SACCO policy limits)
    original_rate = final_rate
    if final_rate < 7.0:
        final_rate = 7.0
        breakdown.append(f"Applied minimum rate (7.0%) - was {original_rate:.1f}%")
    elif final_rate > 22.0:
        final_rate = 22.0
        breakdown.append(f"Applied maximum rate (22.0%) - was {original_rate:.1f}%")
    
    final_rate = round(final_rate, 2)
    breakdown.insert(0, f"⭐ FINAL INTEREST RATE: {final_rate}% ⭐")
    breakdown.append(f"Loan: KES {loan_amount:,.0f} of KES {eligible_amount:,.0f} eligible ({usage_percentage:.1%} usage)")
    
    logger.info(f"💰 Interest rate calculation for {usage_percentage:.1%} usage:")
    for line in breakdown:
        logger.info(f"   {line}")
    
    return {
        'rate': final_rate,
        'breakdown': breakdown,
        'usage_percentage': round(usage_percentage * 100, 1),
        'base_rate': base_rate,
        'adjustments': {
            'usage': usage_adjustment,
            'tenure': tenure_discount,
            'repayment': repayment_discount,
            'discipline': discipline_adjustment
        }
    }

# =============================================================================
# FINAL DECISION MAKER - CONTRIBUTION-AWARE WITH PER-APP RATES & TERMS
# =============================================================================

def make_final_decision(eligibility: Dict, risk: Dict, sentiment: Dict, 
                       requested_amount: float, member_data: Dict, discipline: Dict) -> Dict:
    """Make final loan decision considering contribution discipline"""
    
    eligible_amount = eligibility['amount']
    risk_level = risk['level']
    risk_probability = risk['probability']
    sentiment_risk = sentiment['risk']
    membership_months = member_data['membership_months']
    
    decision_factors = []
    
    # AUTO-REJECT for critical contribution delinquency
    if discipline['level'] == 'CRITICAL':
        decision = "REJECT"
        reason = f"Critical contribution delinquency (Score: {discipline['score']}/100). {discipline['flags'][0] if discipline['flags'] else 'Multiple issues'}"
        confidence = 0.98
        decision_factors.append("CRITICAL_CONTRIBUTION_DELINQUENCY")
    
    # AUTO-REJECT for active overdue with pending
    elif discipline['has_overdue'] and discipline['has_pending']:
        decision = "REJECT"
        reason = f"Has both overdue (KES {discipline['total_overdue_amount']:,.0f}) and pending (KES {discipline['total_pending_amount']:,.0f}) contributions"
        confidence = 0.95
        decision_factors.append("OVERDUE_AND_PENDING_CONTRIBUTIONS")
    
    # REJECT for severe overdue
    elif discipline['has_overdue'] and discipline['overdue_count'] >= 3:
        decision = "REJECT"
        reason = f"Multiple overdue contributions ({discipline['overdue_count']}) totaling KES {discipline['total_overdue_amount']:,.0f}"
        confidence = 0.9
        decision_factors.append("MULTIPLE_OVERDUE_CONTRIBUTIONS")
    
    # REJECT if amount exceeds eligibility
    elif requested_amount > eligible_amount * 1.05:
        decision = "REJECT"
        reason = f"Requested amount (KES {requested_amount:,.0f}) exceeds eligible amount (KES {eligible_amount:,.0f})"
        confidence = 0.9
        decision_factors.append("AMOUNT_EXCEEDS_ELIGIBILITY")
    
    # REJECT for very high risk
    elif risk_level == "VERY HIGH" and risk_probability > 0.7:
        decision = "REJECT"
        reason = f"Very high default risk ({risk_probability:.0%})"
        confidence = risk['confidence'] * 0.95
        decision_factors.append("VERY_HIGH_RISK")
    
    # REJECT new member + high risk
    elif membership_months < 3 and risk_level in ["HIGH", "VERY HIGH"]:
        decision = "REJECT"
        reason = f"New member ({membership_months:.1f} months) with {risk_level} risk"
        confidence = 0.9
        decision_factors.append("NEW_MEMBER_HIGH_RISK")
    
    # APPROVE WITH CAUTION for pending contributions (not overdue)
    elif discipline['has_pending'] and not discipline['has_overdue']:
        decision = "APPROVE_WITH_CAUTION"
        reason = f"Has {discipline['pending_count']} pending contribution(s) (KES {discipline['total_pending_amount']:,.0f}). Clear pending contributions first."
        confidence = 0.7
        decision_factors.append("HAS_PENDING_CONTRIBUTIONS")
    
    # APPROVE WITH CAUTION for poor discipline
    elif discipline['score'] < 50:
        decision = "APPROVE_WITH_CAUTION"
        reason = f"Poor contribution discipline (Score: {discipline['score']}/100)"
        confidence = 0.65
        decision_factors.append("POOR_CONTRIBUTION_DISCIPLINE")
    
    # APPROVE WITH CAUTION for high risk
    elif risk_level == "HIGH":
        decision = "APPROVE_WITH_CAUTION"
        reason = "High risk level requires monitoring and guarantor"
        confidence = risk['confidence']
        decision_factors.append("HIGH_RISK")
    
    # APPROVE WITH CAUTION for new member with significant request
    elif membership_months < 6 and requested_amount > 10000:
        decision = "APPROVE_WITH_CAUTION"
        reason = f"New member ({membership_months:.1f} months) requesting significant amount"
        confidence = 0.7
        decision_factors.append("NEW_MEMBER_LARGE_REQUEST")
    
    # APPROVE for low risk with good discipline
    elif risk_level in ["VERY LOW", "LOW"] and discipline['score'] >= 65:
        decision = "APPROVE"
        reason = "Low risk profile with good contribution discipline"
        confidence = min(0.98, eligibility['confidence'] * risk['confidence'] * 1.1)
        decision_factors.append("LOW_RISK_GOOD_DISCIPLINE")
    
    # APPROVE for low risk
    elif risk_level in ["VERY LOW", "LOW"] and requested_amount <= eligible_amount:
        decision = "APPROVE"
        reason = "Low risk profile with sufficient eligibility"
        confidence = min(0.95, eligibility['confidence'] * risk['confidence'] * 1.1)
        decision_factors.append("LOW_RISK")
    
    # Standard approval
    else:
        decision = "APPROVE"
        reason = "Meets standard approval criteria"
        confidence = (eligibility['confidence'] + risk['confidence']) / 2
        decision_factors.append("STANDARD_APPROVAL")
    
    # Calculate PER-APPLICATION interest rate with breakdown
    rate_result = calculate_interest_rate(
        risk_level=risk_level,
        loan_amount=requested_amount,
        eligible_amount=eligible_amount,
        membership_months=membership_months,
        repayment_rate=member_data['loans']['repayment_rate'],
        discipline_score=discipline['score']
    )
    
    # ============ NEW: Predict repayment term ============
    term_result = predict_repayment_term(
        risk_level=risk_level,
        discipline_score=discipline['score'],
        membership_months=membership_months,
        loan_amount=requested_amount,
        requested_amount=requested_amount,
        eligible_amount=eligible_amount
    )
    
    # Guarantor requirement
    requires_guarantor = (
        membership_months < 6 or
        risk_level in ["HIGH", "VERY HIGH"] or
        requested_amount > 50000 or
        discipline['score'] < 50 or
        decision == "APPROVE_WITH_CAUTION" or
        rate_result['usage_percentage'] > 80
    )
    
    return {
        'decision': decision,
        'reason': reason,
        'confidence': round(confidence, 3),
        'eligible_amount': eligible_amount,
        'risk_level': risk_level,
        'risk_probability': round(risk_probability, 3),
        'sentiment_risk': sentiment_risk,
        'interest_rate': rate_result['rate'],
        'interest_rate_breakdown': rate_result['breakdown'],
        'eligibility_usage_percentage': rate_result['usage_percentage'],
        'recommended_repayment_months': term_result['recommended_months'],
        'repayment_term_breakdown': term_result['breakdown'],
        'min_repayment_months': term_result['min_months'],
        'max_repayment_months': term_result['max_months'],
        'allow_custom_repayment_term': term_result['allow_custom'],
        'decision_factors': decision_factors,
        'requires_guarantor': requires_guarantor,
        'contribution_discipline': {
            'score': discipline['score'],
            'level': discipline['level'],
            'flags': discipline['flags'],
            'pending_count': discipline['pending_count'],
            'overdue_count': discipline['overdue_count'],
            'total_pending': discipline['total_pending_amount'],
            'total_overdue': discipline['total_overdue_amount'],
            'total_penalties': discipline['total_penalties']
        },
        'sources': {
            'eligibility': eligibility['source'],
            'risk': risk['source'],
            'sentiment': sentiment['source']
        }
    }

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def generate_detailed_explanations_for_spring_boot(member_id, eligibility, risk, sentiment, 
                                                   decision, member_data, discipline, loan_amount):
    """Generate detailed explanations with contribution discipline info and per-app rate breakdown"""
    explanations = []
    
    disc_color = "🟢" if discipline['score'] >= 80 else "🟡" if discipline['score'] >= 65 else "🟠" if discipline['score'] >= 50 else "🔴"
    explanations.append({
        "category": "CONTRIBUTION DISCIPLINE",
        "decision": f"{disc_color} {discipline['level']} ({discipline['score']}/100)",
        "reason": f"Pending: {discipline['pending_count']}, Overdue: {discipline['overdue_count']}, Penalties: KES {discipline['total_penalties']:,.0f}",
        "key_factor": "Payment regularity and timeliness",
        "impact": "Critical" if discipline['score'] < 50 else "High" if discipline['score'] < 65 else "Medium"
    })
    
    eligibility_percent = (loan_amount / eligibility['amount'] * 100) if eligibility['amount'] > 0 else 0
    explanations.append({
        "category": "ELIGIBILITY & UTILIZATION",
        "decision": f"KES {eligibility['amount']:,.0f} eligible / {eligibility_percent:.0f}% used",
        "reason": f"Loan request is {eligibility_percent:.0f}% of eligible amount",
        "key_factor": "Member savings, history, and discipline",
        "impact": "High"
    })
    
    risk_impact = "Low" if risk['level'] in ["VERY LOW", "LOW"] else "Medium" if risk['level'] == "MEDIUM" else "High"
    explanations.append({
        "category": "RISK ASSESSMENT",
        "decision": risk['level'],
        "reason": f"{risk['probability']:.1%} default probability",
        "key_factor": "Repayment history and loan patterns",
        "impact": risk_impact
    })
    
    sentiment_impact = "Low" if sentiment['risk'] == "LOW" else "Medium" if sentiment['risk'] == "MEDIUM" else "High"
    explanations.append({
        "category": "LOAN PURPOSE",
        "decision": sentiment['risk'],
        "reason": f"Purpose analyzed with {sentiment['confidence']:.1%} confidence",
        "key_factor": "Loan purpose sentiment",
        "impact": sentiment_impact
    })
    
    # Enhanced interest rate explanation with per-application breakdown
    rate_breakdown_text = " → ".join([line for line in decision.get('interest_rate_breakdown', []) if not line.startswith('⭐')][:3])
    explanations.append({
        "category": "INTEREST RATE (PER APPLICATION)",
        "decision": f"{decision['interest_rate']}%",
        "reason": f"Based on {decision['eligibility_usage_percentage']:.0f}% utilization of eligibility",
        "key_factor": rate_breakdown_text,
        "impact": "Risk-based pricing"
    })
    
    # NEW: Repayment term explanation
    explanations.append({
        "category": "REPAYMENT TERM (ML PREDICTED)",
        "decision": f"{decision['recommended_repayment_months']} months",
        "reason": f"Optimal term based on your risk profile ({risk['level']}) and discipline",
        "key_factor": "Risk-based personalized term",
        "impact": f"Range: {decision['min_repayment_months']}-{decision['max_repayment_months']} months"
    })
    
    decision_impact = "Positive" if decision['decision'] == "APPROVE" else "Caution" if "CAUTION" in decision['decision'] else "Negative"
    explanations.append({
        "category": "FINAL DECISION",
        "decision": decision['decision'],
        "reason": decision['reason'],
        "key_factor": "Overall assessment",
        "impact": decision_impact
    })
    
    summary = {
        "key_recommendation": decision['decision'],
        "primary_reason": decision['reason'],
        "interest_rate_justification": f"{decision['interest_rate']}% (utilization: {decision['eligibility_usage_percentage']:.0f}%)",
        "recommended_term": f"{decision['recommended_repayment_months']} months",
        "recommendedTerm": f"{decision['recommended_repayment_months']} months",
        "confidence_level": "HIGH" if decision['confidence'] > 0.8 else "MEDIUM" if decision['confidence'] > 0.6 else "LOW",
        "guarantor_required": decision.get('requires_guarantor', False),
        "contribution_discipline_score": discipline['score'],
        "flags": discipline['flags']
    }
    
    return {
        "member_id": member_id,
        "explanations": explanations,
        "summary": summary
    }

def generate_decision_table_for_spring_boot(decision):
    """Generate decision table with per-application rate details"""
    interest_rate_breakdown = [
        {"component": "Base Rate", "value": f"{decision.get('interest_rate_breakdown', [])[1] if len(decision.get('interest_rate_breakdown', [])) > 1 else 'N/A'}", "reason": "Risk level based"},
        {"component": "Utilization Adjustment", "value": f"{decision['eligibility_usage_percentage']:.0f}% usage", "reason": "Higher utilization = higher rate"},
        {"component": "Tenure & Discipline", "value": f"{decision['contribution_discipline']['level']}", "reason": "Loyalty & payment behavior"},
        {"component": "Final Rate", "value": f"{decision['interest_rate']}%", "reason": "Per-application risk pricing"}
    ]
    
    eligibility_factors = [
        {"factor": "Maximum Eligibility", "status": f"KES {decision['eligible_amount']:,.0f}", "impact": "Primary limit"},
        {"factor": "Amount Requested", "status": f"{decision['eligibility_usage_percentage']:.0f}% of eligible", "impact": "Affects interest rate"},
        {"factor": "Risk Level", "status": decision['risk_level'], "impact": "Affects approval and rate"},
        {"factor": "Contribution Discipline", "status": f"{decision['contribution_discipline']['level']} ({decision['contribution_discipline']['score']}/100)", "impact": "Affects eligibility and rate"},
        {"factor": "Loan Purpose", "status": decision['sentiment_risk'], "impact": "Risk assessment"},
        {"factor": "Repayment Term", "status": f"{decision['recommended_repayment_months']} months (ML recommended)", "impact": "Based on risk profile"},
        {"factor": "Guarantor Required", "status": "Yes" if decision.get('requires_guarantor') else "No", "impact": "Additional security"}
    ]
    
    risk_assessment = [
        {"risk_category": "Default Probability", "level": decision['risk_level'], "score": f"{decision['risk_probability']:.1%}"},
        {"risk_category": "Contribution Discipline", "level": decision['contribution_discipline']['level'], "score": f"{decision['contribution_discipline']['score']}/100"},
        {"risk_category": "Loan Purpose Risk", "level": decision['sentiment_risk'], "score": "From sentiment analysis"},
        {"risk_category": "Eligibility Utilization", "level": "HIGH" if decision['eligibility_usage_percentage'] > 80 else "MEDIUM" if decision['eligibility_usage_percentage'] > 50 else "LOW", "score": f"{decision['eligibility_usage_percentage']:.0f}%"}
    ]
    
    recommendations = [
        {"action": "Loan Decision", "status": decision['decision'], "details": decision['reason']},
        {"action": "Interest Rate", "status": f"{decision['interest_rate']}%", "details": f"Based on {decision['eligibility_usage_percentage']:.0f}% utilization"},
        {"action": "Repayment Term", "status": f"{decision['recommended_repayment_months']} months", "details": "ML-predicted optimal term based on your risk profile"},
        {"action": "Clear Pending", "status": "Required" if decision['contribution_discipline']['pending_count'] > 0 else "None", "details": f"{decision['contribution_discipline']['pending_count']} pending contributions"},
        {"action": "Guarantor", "status": "Required" if decision.get('requires_guarantor') else "Not Required", "details": "Additional security requirement"}
    ]
    
    return {
        "interest_rate_breakdown": interest_rate_breakdown,
        "eligibility_factors": eligibility_factors,
        "risk_assessment": risk_assessment,
        "recommendations": recommendations,
        "summary": f"Decision: {decision['decision']} at {decision['interest_rate']}% interest | Term: {decision['recommended_repayment_months']} months | Usage: {decision['eligibility_usage_percentage']:.0f}% of eligibility"
    }

# =============================================================================
# MAIN PROCESSING FUNCTION
# =============================================================================

def process_loan_request(member_id: str, loan_amount: float, loan_purpose: str) -> Dict:
    """Main function to process loan request with contribution discipline"""
    logger.info(f"🚀 Processing loan request for member {member_id}")
    
    fetcher = DatabaseFetcher()
    member_data = fetcher.fetch_member_data(member_id)
    
    discipline = calculate_contribution_discipline_score(member_data['contributions'])
    
    logger.info(f"📊 MEMBER DATA:")
    logger.info(f"   Membership: {member_data['membership_months']:.1f} months")
    logger.info(f"   Status: {member_data['member']['status']}")
    logger.info(f"   Contributions: {member_data['contributions']['completed_count']} completed, "
               f"{member_data['contributions']['pending_count']} pending, "
               f"{member_data['contributions']['overdue_count']} overdue")
    logger.info(f"   Discipline Score: {discipline['score']}/100 ({discipline['level']})")
    if discipline['flags']:
        for flag in discipline['flags']:
            logger.info(f"   ⚠️ {flag}")
    
    logger.info(f"🤖 Making ML predictions...")
    eligibility = predict_eligibility_with_model(member_data, discipline)
    risk = predict_risk_with_model(member_data, discipline)
    sentiment = predict_sentiment_with_model(loan_purpose)
    
    logger.info(f"📈 Predictions:")
    logger.info(f"   Eligibility: KES {eligibility['amount']:,.0f} [{eligibility['source']}]")
    logger.info(f"   Risk: {risk['level']} ({risk['probability']:.1%}) [{risk['source']}]")
    logger.info(f"   Sentiment: {sentiment['risk']} [{sentiment['source']}]")
    
    decision = make_final_decision(eligibility, risk, sentiment, loan_amount, member_data, discipline)
    
    logger.info(f"🎯 Decision: {decision['decision']} ({decision['confidence']:.1%})")
    logger.info(f"   Interest: {decision['interest_rate']}% (Usage: {decision['eligibility_usage_percentage']:.0f}%)")
    logger.info(f"   Recommended Term: {decision['recommended_repayment_months']} months")
    logger.info(f"   Guarantor: {'Yes' if decision['requires_guarantor'] else 'No'}")
    
    response = {
        'member_id': member_id,
        'final_recommendation': decision['decision'],
        'final_confidence': decision['confidence'],
        'decision_reasoning': decision['reason'],
        
        'eligibility_amount': eligibility['amount'],
        'eligibility_confidence': eligibility['confidence'],
        
        'loan_risk': risk['level'],
        'risk_probability': risk['probability'],
        'risk_confidence': risk['confidence'],
        
        'sentiment_risk': sentiment['risk'],
        'sentiment_confidence': sentiment['confidence'],
        
        'member_status': member_data['member']['status'],
        'member_role': member_data['member']['role'],
        'membership_months': round(member_data['membership_months'], 1),
        
        'contribution_discipline_score': discipline['score'],
        'contribution_discipline_level': discipline['level'],
        'has_pending_contributions': discipline['has_pending'],
        'has_overdue_contributions': discipline['has_overdue'],
        'pending_contribution_count': discipline['pending_count'],
        'overdue_contribution_count': discipline['overdue_count'],
        'total_pending_amount': discipline['total_pending_amount'],
        'total_overdue_amount': discipline['total_overdue_amount'],
        'total_penalties': discipline['total_penalties'],
        'contribution_flags': discipline['flags'],
        
        'loan_amount_requested': loan_amount,
        'loan_reason': loan_purpose,
        
        'data_source': f"{eligibility['source']}/{risk['source']}/{sentiment['source']}",
        
        'interest_rate': decision['interest_rate'],
        'interest_rate_breakdown': decision['interest_rate_breakdown'],
        'eligibility_usage_percentage': decision['eligibility_usage_percentage'],
        'requires_guarantor': decision['requires_guarantor'],
        
        # NEW: ML-predicted repayment term fields
        'recommended_repayment_months': decision['recommended_repayment_months'],
        'recommendedRepaymentMonths': decision['recommended_repayment_months'],
        'repayment_term_breakdown': decision['repayment_term_breakdown'],
        'min_repayment_months': decision['min_repayment_months'],
        'max_repayment_months': decision['max_repayment_months'],
        'allow_custom_repayment_term': decision['allow_custom_repayment_term'],
        
        'ml_orchestrator_version': '10.0-ml-term-prediction',
        'processed_at': datetime.now().isoformat(),
        
        'detailed_explanations': generate_detailed_explanations_for_spring_boot(
            member_id, eligibility, risk, sentiment, decision, member_data, discipline, loan_amount
        ),
        
        'decision_table': generate_decision_table_for_spring_boot(decision),
        
        'html_decision_table': f"""
        <div style='font-family: Arial; padding: 15px;'>
            <h3>Loan Decision Summary</h3>
            <p><strong>Recommendation:</strong> {decision['decision']}</p>
            <p><strong>Interest Rate:</strong> {decision['interest_rate']}% (Per-application pricing)</p>
            <p><strong>Recommended Term:</strong> {decision['recommended_repayment_months']} months</p>
            <p><strong>Eligibility:</strong> KES {eligibility['amount']:,.0f}</p>
            <p><strong>Requested:</strong> KES {loan_amount:,.0f} ({decision['eligibility_usage_percentage']:.0f}% of eligibility)</p>
            <p><strong>Risk Level:</strong> {risk['level']} ({risk['probability']:.1%})</p>
            <p><strong>Contribution Discipline:</strong> {discipline['level']} ({discipline['score']}/100)</p>
            <p><strong>Term Breakdown:</strong><br>{'<br>'.join(decision['repayment_term_breakdown'][:5])}</p>
            <p><strong>Rate Breakdown:</strong><br>{'<br>'.join(decision['interest_rate_breakdown'][:5])}</p>
            <p><strong>Guarantor Required:</strong> {'Yes' if decision['requires_guarantor'] else 'No'}</p>
            {f'<p style="color:red;"><strong>⚠️ Flags:</strong> {"; ".join(discipline["flags"])}</p>' if discipline['flags'] else ''}
        </div>
        """
    }
    
    return response

# =============================================================================
# FLASK APP
# =============================================================================

app = Flask(__name__)
CORS(app)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'models_loaded': {
            'eligibility': ELIGIBILITY_MODEL is not None,
            'risk': RISK_MODEL is not None,
            'sentiment': SENTIMENT_MODEL is not None
        },
        'ml_models_ready': ML_MODELS_READY,
        'features': 'per_application_risk_pricing_ml_term',
        'database': 'configured',
        'api_version': '10.0-ml-term-prediction',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/v1/loan_decision', methods=['POST'])
def loan_decision():
    """Main API endpoint with per-application risk pricing and ML term prediction"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        logger.info(f"📥 Request received with keys: {list(data.keys())}")
        
        member_id = None
        for key in ['memberId', 'member_id', 'id']:
            if key in data:
                member_id = str(data[key])
                break
        
        if not member_id and 'memberProfile' in data and isinstance(data['memberProfile'], dict):
            member_id = str(data['memberProfile'].get('id') or data['memberProfile'].get('memberId', ''))
        
        loan_amount = 0
        for key in ['loanAmount', 'loan_amount', 'amount', 'requestedAmount']:
            if key in data:
                try:
                    loan_amount = float(data[key])
                    break
                except (ValueError, TypeError):
                    continue
        
        loan_purpose = 'General purpose'
        for key in ['loanPurpose', 'loan_purpose', 'purpose', 'reason', 'loanReason']:
            if key in data:
                loan_purpose = str(data[key])
                break
        
        if not member_id:
            return jsonify({'error': 'Member ID is required', 'received_fields': list(data.keys())}), 400
        
        if loan_amount <= 0:
            return jsonify({'error': 'Valid loanAmount is required'}), 400
        
        logger.info(f"🎯 Processing: member={member_id}, amount={loan_amount:,.0f}")
        result = process_loan_request(member_id, loan_amount, loan_purpose)
        result['api_version'] = '10.0-ml-term-prediction'
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"API error: {e}")
        logger.exception("Full traceback:")
        return jsonify({'error': f'Processing error: {str(e)}'}), 500

@app.route('/api/v1/rate_preview', methods=['POST'])
def rate_preview():
    """Let members see their rate BEFORE applying."""
    try:
        data = request.get_json()
        member_id = data.get('member_id')
        test_amounts = data.get('test_amounts', [5000, 10000, 20000, 50000])
        
        if not member_id:
            return jsonify({'error': 'member_id required'}), 400
        
        fetcher = DatabaseFetcher()
        member_data = fetcher.fetch_member_data(member_id)
        discipline = calculate_contribution_discipline_score(member_data['contributions'])
        eligibility = predict_eligibility_with_model(member_data, discipline)
        risk = predict_risk_with_model(member_data, discipline)
        
        scenarios = []
        for amount in test_amounts:
            if amount <= eligibility['amount']:
                rate_result = calculate_interest_rate(
                    risk_level=risk['level'],
                    loan_amount=amount,
                    eligible_amount=eligibility['amount'],
                    membership_months=member_data['membership_months'],
                    repayment_rate=member_data['loans']['repayment_rate'],
                    discipline_score=discipline['score']
                )
                term_result = predict_repayment_term(
                    risk_level=risk['level'],
                    discipline_score=discipline['score'],
                    membership_months=member_data['membership_months'],
                    loan_amount=amount,
                    requested_amount=amount,
                    eligible_amount=eligibility['amount']
                )
                scenarios.append({
                    'loan_amount': amount,
                    'usage_percentage': round((amount / eligibility['amount']) * 100, 1),
                    'interest_rate': rate_result['rate'],
                    'recommended_term': term_result['recommended_months'],
                    'monthly_payment_est': round((amount * (rate_result['rate']/100) / term_result['recommended_months']) + (amount / term_result['recommended_months']), 2),
                    'total_interest_est': round(amount * (rate_result['rate']/100), 2)
                })
        
        return jsonify({
            'member_id': member_id,
            'max_eligible': eligibility['amount'],
            'risk_level': risk['level'],
            'discipline_score': discipline['score'],
            'discipline_level': discipline['level'],
            'scenarios': scenarios,
            'note': 'Higher loan amounts = higher interest rate. Term is ML-predicted based on risk profile.'
        })
        
    except Exception as e:
        logger.error(f"Rate preview error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/test_decision', methods=['GET'])
def test_decision():
    """Test endpoint"""
    try:
        result = process_loan_request(
            member_id='test_member_001',
            loan_amount=25000,
            loan_purpose='Business expansion'
        )
        result['member_id'] = 'test_member_001 (Sample)'
        return jsonify({'test': 'successful', 'decision': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/debug/member/<member_id>', methods=['GET'])
def debug_member(member_id):
    """Debug endpoint - shows full member data including discipline"""
    try:
        fetcher = DatabaseFetcher()
        member_data = fetcher.fetch_member_data(member_id)
        discipline = calculate_contribution_discipline_score(member_data['contributions'])
        
        return jsonify({
            'member_id': member_id,
            'member': member_data['member'],
            'contributions': member_data['contributions'],
            'loans': member_data['loans'],
            'membership_months': member_data['membership_months'],
            'contribution_discipline': discipline
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/debug/discipline/<member_id>', methods=['GET'])
def debug_discipline(member_id):
    """Dedicated endpoint to check contribution discipline only"""
    try:
        fetcher = DatabaseFetcher()
        member_data = fetcher.fetch_member_data(member_id)
        discipline = calculate_contribution_discipline_score(member_data['contributions'])
        
        return jsonify({
            'member_id': member_id,
            'discipline': discipline,
            'raw_contributions': {
                'pending_count': member_data['contributions']['pending_count'],
                'overdue_count': member_data['contributions']['overdue_count'],
                'severely_overdue': member_data['contributions']['severely_overdue_count'],
                'pending_amount': member_data['contributions']['total_pending'],
                'overdue_amount': member_data['contributions']['total_overdue'],
                'penalties': member_data['contributions']['total_penalties'],
                'completion_rate': member_data['contributions']['completion_rate'],
                'days_since_last': member_data['contributions']['days_since_last_contribution'],
                'late_payments': member_data['contributions']['late_payment_count']
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/v1/debug/decisions/all', methods=['GET'])
def get_all_decisions():
    """Returns all loan decisions WITH actual interest rates from loans table."""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        
        # ✅ FIXED: Removed non-existent repayment_months column
        cursor.execute("""
            SELECT 
                d.id,
                d.member_id,
                d.loan_reason,
                d.requested_amount,
                d.eligibility_amount,
                d.eligibility_confidence,
                d.loan_risk,
                d.risk_probability,
                d.risk_confidence,
                d.sentiment_risk,
                d.sentiment_confidence,
                d.final_recommendation,
                d.final_confidence,
                d.decision_reasoning,
                d.member_status,
                d.member_role,
                d.membership_months,
                d.data_source,
                d.ml_orchestrator_version,
                d.raw_ml_response,
                d.created_at as processed_at,
                l.interest_rate as loan_interest_rate,
                l.status as loan_status,
                l.id as loan_id,
                l.start_date as loan_start_date,
                l.due_date as loan_due_date
            FROM loan_decision_log d
            LEFT JOIN loans l ON d.id = l.ml_decision_log_id
            ORDER BY d.created_at DESC
            LIMIT 100
        """)
        
        decisions = cursor.fetchall()
        cursor.close()
        conn.close()
        
        import json
        from datetime import datetime
        
        results = []
        for decision in decisions:
            try:
                extra = json.loads(decision.get('raw_ml_response') or '{}')
                discipline = extra.get('contribution_discipline', {})
                
                interest_rate = decision.get('loan_interest_rate')
                if not interest_rate:
                    interest_rate = extra.get('interest_rate')
                if not interest_rate:
                    risk = decision.get('loan_risk', 'MEDIUM')
                    risk_adj = {'VERY LOW': 7.5, 'LOW': 9.0, 'MEDIUM': 10.0, 'HIGH': 13.0, 'VERY HIGH': 15.0}
                    interest_rate = risk_adj.get(risk, 10.0)
                
                # ✅ Calculate repayment months from start_date and due_date
                loan_repayment_months = None
                start_date = decision.get('loan_start_date')
                due_date = decision.get('loan_due_date')
                if start_date and due_date:
                    try:
                        start = start_date if isinstance(start_date, datetime) else datetime.strptime(str(start_date), '%Y-%m-%d')
                        end = due_date if isinstance(due_date, datetime) else datetime.strptime(str(due_date), '%Y-%m-%d')
                        loan_repayment_months = (end.year - start.year) * 12 + (end.month - start.month)
                        if loan_repayment_months < 0:
                            loan_repayment_months = None
                    except:
                        pass
                
                results.append({
                    'id': decision['id'],
                    'memberId': decision['member_id'],
                    'requestedAmount': float(decision['requested_amount'] or 0),
                    'loanReason': decision['loan_reason'],
                    'finalRecommendation': decision['final_recommendation'],
                    'finalConfidence': float(decision['final_confidence'] or 0),
                    'decisionReasoning': decision['decision_reasoning'],
                    'eligibilityAmount': float(decision['eligibility_amount'] or 0),
                    'eligibilityConfidence': float(decision['eligibility_confidence'] or 0),
                    'loanRisk': decision['loan_risk'],
                    'riskProbability': float(decision['risk_probability'] or 0),
                    'riskConfidence': float(decision['risk_confidence'] or 0),
                    'sentimentRisk': decision['sentiment_risk'],
                    'sentimentConfidence': float(decision['sentiment_confidence'] or 0),
                    'memberStatus': decision['member_status'],
                    'memberRole': decision['member_role'],
                    'membershipMonths': float(decision['membership_months'] or 0),
                    'dataSource': decision['data_source'],
                    'processedAt': str(decision['processed_at']) if decision['processed_at'] else None,
                    'contributionDisciplineScore': discipline.get('score'),
                    'contributionDisciplineLevel': discipline.get('level'),
                    'hasPendingContributions': discipline.get('pending_count', 0) > 0,
                    'hasOverdueContributions': discipline.get('overdue_count', 0) > 0,
                    'pendingContributionCount': discipline.get('pending_count', 0),
                    'overdueContributionCount': discipline.get('overdue_count', 0),
                    'totalPendingAmount': discipline.get('total_pending', 0),
                    'totalOverdueAmount': discipline.get('total_overdue', 0),
                    'totalPenalties': discipline.get('total_penalties', 0),
                    'contributionFlags': discipline.get('flags', []),
                    'requiresGuarantor': extra.get('requires_guarantor', False),
                    'interestRate': float(interest_rate) if interest_rate else None,
                    'eligibilityUsagePercentage': extra.get('eligibility_usage_percentage'),
                    'recommendedRepaymentMonths': extra.get('recommended_repayment_months'),
                    'loanStatus': decision.get('loan_status'),
                    'loanId': decision.get('loan_id'),
                    'loanRepaymentMonths': loan_repayment_months,  # ✅ Calculated from dates
                })
            except Exception as e:
                print(f"Error processing decision: {e}")
                results.append({
                    'id': decision['id'],
                    'memberId': decision['member_id'],
                    'requestedAmount': float(decision['requested_amount'] or 0),
                    'loanReason': decision['loan_reason'],
                    'finalRecommendation': decision['final_recommendation'],
                    'finalConfidence': float(decision['final_confidence'] or 0),
                    'decisionReasoning': decision['decision_reasoning'],
                    'loanRisk': decision['loan_risk'],
                    'processedAt': str(decision['processed_at']) if decision['processed_at'] else None,
                    'interestRate': float(decision['loan_interest_rate']) if decision.get('loan_interest_rate') else None,
                })
        
        return jsonify(results)
        
    except Exception as e:
        logger.error(f"Error fetching all decisions: {e}")
        return jsonify({'error': str(e), 'decisions': []}), 500

if __name__ == '__main__':
    print("\n" + "="*70)
    print("🚀 LOAN ORCHESTRATOR API v10.0 - ML TERM PREDICTION")
    print("="*70)
    print(f"📊 Eligibility Model: {'✅' if ELIGIBILITY_MODEL else '❌'}")
    print(f"📊 Risk Model: {'✅' if RISK_MODEL else '❌'}")
    print(f"📊 Sentiment Model: {'✅' if SENTIMENT_MODEL else '❌'}")
    print("="*70)
    print("📡 API Running on http://localhost:5000")
    print("\n📋 ENDPOINTS:")
    print("  GET  /health                              - Health check")
    print("  POST /api/v1/loan_decision                - Main loan decision endpoint")
    print("  POST /api/v1/rate_preview                 - Preview rates for different amounts")
    print("  GET  /api/v1/test_decision                - Test with sample data")
    print("  GET  /api/v1/debug/member/<id>            - Full member debug")
    print("  GET  /api/v1/debug/discipline/<id>        - Discipline score debug")
    print("\n🎯 v10.0 NEW FEATURES:")
    print("  1. ✅ PER-APPLICATION interest rates (different amounts = different rates)")
    print("  2. ✅ Full rate breakdown for transparency")
    print("  3. ✅ Usage percentage impacts rate (20% usage = lower rate than 80%)")
    print("  4. ✅ New /rate_preview endpoint to test different scenarios")
    print("  5. ✅ Members can see rates BEFORE applying")
    print("  6. ✅✅ NEW: ML-predicted repayment terms (3-24 months based on risk profile)")
    print("  7. ✅✅ Term breakdown shows WHY member got that term")
    print("\n💰 How rates work:")
    print("   - Base rate by risk level: 7% (VERY LOW) to 18% (VERY HIGH)")
    print("   - Usage adjustment: -1% to +3% based on % of eligibility used")
    print("   - Loyalty discount: up to -1% for 3+ years membership")
    print("   - Repayment discount: up to -1% for excellent history")
    print("   - Discipline adjustment: -1% to +2.5% based on contribution behavior")
    print("   - Final rate capped between 7% and 22%")
    print("\n📅 How repayment terms work (NEW):")
    print("   - VERY LOW risk: 24 months recommended")
    print("   - LOW risk: 18 months recommended")
    print("   - MEDIUM risk: 12 months recommended")
    print("   - HIGH risk: 6 months recommended")
    print("   - VERY HIGH risk: 3 months recommended")
    print("   - Adjusted by discipline score and membership tenure")
    print("   - High usage (>80% of limit) reduces term by 3 months")
    print("="*70)
    
    app.run(host='0.0.0.0', port=5000, debug=True)