# sentiment-analyzer/model.py - COMPLETE FIXED VERSION
import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib
import os
import re
import nltk
from nltk.sentiment import SentimentIntensityAnalyzer
from scipy.sparse import hstack, csr_matrix

# Download required NLTK data
try:
    nltk.data.find('vader_lexicon')
except LookupError:
    nltk.download('vader_lexicon')

class SentimentAnalyzer:
    def __init__(self):
        self.model = None
        self.vectorizer = TfidfVectorizer(max_features=500, stop_words='english', min_df=2, max_df=0.8)
        self.sia = SentimentIntensityAnalyzer()
        self.channel_names = None  # Store channel names from training
    
    def load_data(self):
        """Load the member comments data"""
        print("📊 Loading member comments data for LOAN PURPOSE analysis...")
        
        try:
            comments_df = pd.read_csv('../data/member_comments_ml_training.csv')
            print(f"✅ Loaded: {len(comments_df)} comments")
            
            # Show sample loan purposes
            loan_purposes = comments_df[comments_df['type'] == 'Loan Application']['messageContent'].head(5)
            print(f"📝 Sample Loan Purposes:")
            for i, purpose in enumerate(loan_purposes):
                print(f"   {i+1}. '{purpose[:80]}...'")
                
            return comments_df
            
        except FileNotFoundError as e:
            print(f"❌ Error loading data: {e}")
            print("💡 Make sure data/member_comments_ml_training.csv exists")
            raise
    
    def classify_loan_purpose_risk(self, text):
        """Classify loan purpose into risk categories: LOW, MEDIUM, HIGH"""
        if pd.isna(text):
            return "MEDIUM"
        
        text_lower = str(text).lower()
        
        # LOW RISK purposes (productive, income-generating)
        low_risk_keywords = [
            'business', 'investment', 'farm', 'agriculture', 'dairy', 'poultry',
            'education', 'school', 'college', 'university', 'tuition', 'fees',
            'equipment', 'machine', 'vehicle', 'transport', 'matatu', 'boda',
            'shop', 'store', 'supermarket', 'salon', 'barber', 'tailoring',
            'construction', 'building', 'house', 'rental', 'property',
            'expansion', 'growth', 'development', 'capital', 'stock'
        ]
        
        # HIGH RISK purposes (consumptive, emergency, debt)
        high_risk_keywords = [
            'emergency', 'medical', 'hospital', 'sickness', 'illness', 'death',
            'funeral', 'burial', 'debt', 'loan repayment', 'pay debt',
            'wedding', 'ceremony', 'celebration', 'party', 'festival',
            'personal', 'consumption', 'shopping', 'luxury', 'holiday',
            'unknown', 'others', 'miscellaneous', 'urgent', 'immediate'
        ]
        
        # Check for low risk keywords
        for keyword in low_risk_keywords:
            if keyword in text_lower:
                return "LOW"
        
        # Check for high risk keywords
        for keyword in high_risk_keywords:
            if keyword in text_lower:
                return "HIGH"
        
        # Default to MEDIUM risk
        return "MEDIUM"
    
    def preprocess_text(self, text):
        """Clean and preprocess text"""
        if pd.isna(text):
            return "no text"
        
        text = str(text).lower()
        text = re.sub(r'[^\w\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        
        if not text:
            return "no content"
        
        return text
    
    def extract_features(self, df):
        """Extract features from comments data"""
        print("🔧 Extracting loan purpose features...")
        
        # Preprocess text
        df['cleaned_text'] = df['messageContent'].apply(self.preprocess_text)
        
        # Check if we have valid text
        text_lengths = df['cleaned_text'].apply(len)
        print(f"📏 Text length stats - Min: {text_lengths.min()}, Max: {text_lengths.max()}, Mean: {text_lengths.mean():.1f}")
        
        # Basic text features
        df['text_length'] = text_lengths
        df['word_count'] = df['cleaned_text'].apply(lambda x: len(x.split()))
        
        # VADER sentiment scores
        print("📊 Calculating VADER sentiment scores...")
        df['vader_compound'] = df['cleaned_text'].apply(lambda x: self.sia.polarity_scores(x)['compound'])
        df['vader_positive'] = df['cleaned_text'].apply(lambda x: self.sia.polarity_scores(x)['pos'])
        df['vader_negative'] = df['cleaned_text'].apply(lambda x: self.sia.polarity_scores(x)['neg'])
        df['vader_neutral'] = df['cleaned_text'].apply(lambda x: self.sia.polarity_scores(x)['neu'])
        
        # Channel encoding - Store the channel names for prediction
        if 'channel' in df.columns:
            # Get unique channels and sort them for consistency
            unique_channels = sorted(df['channel'].dropna().unique())
            self.channel_names = unique_channels
            print(f"📱 Channels found: {unique_channels}")
            
            # Create one-hot encoding
            for channel in unique_channels:
                df[f'channel_{channel}'] = (df['channel'] == channel).astype(np.float64)
        
        return df
    
    def prepare_training_data(self, comments_df):
        """Prepare data for LOAN PURPOSE RISK analysis"""
        print("📊 Preparing training data for LOAN PURPOSE RISK...")
        
        # Filter only Loan Application messages for training
        loan_apps = comments_df[comments_df['type'] == 'Loan Application'].copy()
        
        if len(loan_apps) == 0:
            print("⚠️ No loan applications found. Using all comments.")
            loan_apps = comments_df.copy()
        
        print(f"📋 Using {len(loan_apps)} loan applications for training")
        
        # Extract features
        features_df = self.extract_features(loan_apps)
        
        # CREATE REAL LOAN PURPOSE RISK LABELS
        print("🎯 Classifying loan purposes into risk levels...")
        features_df['risk_label'] = features_df['messageContent'].apply(self.classify_loan_purpose_risk)
        
        # Show distribution
        print(f"📊 Loan Purpose Risk Distribution:")
        risk_counts = features_df['risk_label'].value_counts()
        for risk, count in risk_counts.items():
            percentage = count / len(features_df) * 100
            print(f"   - {risk}: {count} purposes ({percentage:.1f}%)")
        
        # Handle any NaN labels
        features_df = features_df.dropna(subset=['risk_label'])
        
        # Check sample classifications
        print(f"\n📝 Sample Classifications:")
        samples = features_df.head(5)
        for i, (_, row) in enumerate(samples.iterrows()):
            purpose_preview = row['messageContent'][:60] + "..." if len(row['messageContent']) > 60 else row['messageContent']
            print(f"   {i+1}. [{row['risk_label']}] '{purpose_preview}'")
        
        # Text features
        try:
            print("🔤 Creating TF-IDF features...")
            text_features = self.vectorizer.fit_transform(features_df['cleaned_text'])
            print(f"✅ TF-IDF features created: {text_features.shape}")
        except Exception as e:
            print(f"❌ TF-IDF failed: {e}")
            print("🔄 Using alternative features...")
            text_features = csr_matrix((len(features_df), 1))
        
        # Additional features - MUST be in same order as prediction
        feature_columns = [
            'text_length', 'word_count', 
            'vader_compound', 'vader_positive', 'vader_negative', 'vader_neutral'
        ]
        
        # Add channel features if available (in alphabetical order)
        if self.channel_names:
            for channel in sorted(self.channel_names):
                col_name = f'channel_{channel}'
                if col_name in features_df.columns:
                    feature_columns.append(col_name)
        
        additional_features = features_df[feature_columns].astype(np.float64).values
        
        # Combine all features
        if hasattr(text_features, 'shape') and text_features.shape[1] > 1:
            X = hstack([text_features, additional_features])
        else:
            X = csr_matrix(additional_features)
        
        y = features_df['risk_label']
        
        print(f"✅ Training data prepared: {X.shape[0]} samples, {X.shape[1]} features")
        
        return X, y, features_df
    
    def train(self, save_model=True):
        """Train the loan purpose risk analysis model"""
        print("🤖 Training Loan Purpose Risk Analyzer...")
        
        # Load data
        comments_df = self.load_data()
        
        # Prepare training data
        X, y, features_df = self.prepare_training_data(comments_df)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.3, random_state=42, stratify=y
        )
        
        print(f"📈 Train set: {X_train.shape[0]} loan purposes")
        print(f"📈 Test set: {X_test.shape[0]} loan purposes")
        
        # Train model
        self.model = RandomForestClassifier(
            n_estimators=150,
            max_depth=10,
            min_samples_split=8,
            min_samples_leaf=4,
            class_weight='balanced',
            random_state=42
        )
        
        self.model.fit(X_train, y_train)
        
        # Evaluate
        train_score = self.model.score(X_train, y_train)
        test_score = self.model.score(X_test, y_test)
        
        # Predict
        y_pred = self.model.predict(X_test)
        
        print(f"✅ Training completed!")
        print(f"📊 Train Accuracy: {train_score:.4f}")
        print(f"📊 Test Accuracy: {test_score:.4f}")
        
        print("\n📈 Classification Report:")
        print(classification_report(y_test, y_pred))
        
        if save_model:
            self.save_model()
        
        return test_score
    
    def prepare_loan_purpose_features(self, loan_purpose_text, channel='application'):
        """Prepare features for loan purpose risk prediction - FIXED VERSION"""
        # Preprocess text
        cleaned_text = self.preprocess_text(loan_purpose_text)
        
        # 1. TF-IDF features
        try:
            text_features = self.vectorizer.transform([cleaned_text])
        except Exception as e:
            # Create zero vector with correct dimensions
            n_tfidf_features = len(self.vectorizer.get_feature_names_out()) if hasattr(self.vectorizer, 'get_feature_names_out') else 63
            text_features = csr_matrix((1, n_tfidf_features))
        
        # 2. Basic text features (2 features)
        text_length = len(cleaned_text)
        word_count = len(cleaned_text.split())
        
        # 3. VADER sentiment features (4 features)
        vader_scores = self.sia.polarity_scores(cleaned_text)
        
        # 4. Channel features - CRITICAL FIX!
        channel_features = []
        if self.channel_names:
            # Use the SAME channel order as training
            for ch in sorted(self.channel_names):
                if str(channel).strip().lower() == str(ch).strip().lower():
                    channel_features.append(1.0)
                else:
                    channel_features.append(0.0)
        else:
            # Default channels if not set
            default_channels = ['Email', 'Meeting', 'Mobile App', 'SMS', 'WhatsApp']
            for ch in sorted(default_channels):
                if str(channel).strip().lower() == str(ch).strip().lower():
                    channel_features.append(1.0)
                else:
                    channel_features.append(0.0)
        
        # Combine all features in EXACT SAME ORDER as training
        additional_features = np.array([[
            text_length,                     # text_length
            word_count,                      # word_count
            vader_scores['compound'],        # vader_compound
            vader_scores['pos'],             # vader_positive
            vader_scores['neg'],             # vader_negative
            vader_scores['neu']              # vader_neutral
        ]], dtype=np.float64)
        
        # Add channel features
        channel_array = np.array([channel_features], dtype=np.float64)
        combined_additional = np.hstack([additional_features, channel_array])
        
        # Convert to sparse and combine with TF-IDF
        combined_sparse = csr_matrix(combined_additional)
        
        if text_features.shape[1] > 0:
            features = hstack([text_features, combined_sparse])
        else:
            features = combined_sparse
        
        return features
    
    def predict_loan_purpose_risk(self, loan_purpose_text, channel='application'):
        """Analyze risk level of a loan purpose - FIXED VERSION"""
        if self.model is None:
            raise ValueError("Model not trained. Call train() first.")
        
        # Prepare features
        features = self.prepare_loan_purpose_features(loan_purpose_text, channel)
        
        # Calculate VADER scores
        cleaned_text = self.preprocess_text(loan_purpose_text)
        vader_scores = self.sia.polarity_scores(cleaned_text)
        
        # Debug: Check feature dimensions
        print(f"🔍 Debug: Features shape: {features.shape}")
        print(f"🔍 Debug: Model expects: {self.model.n_features_in_} features")
        
        # Ensure feature dimensions match
        if features.shape[1] != self.model.n_features_in_:
            print(f"⚠️ Feature mismatch: Got {features.shape[1]}, expected {self.model.n_features_in_}")
            print("🔄 Adjusting feature dimensions...")
            
            # Pad or trim features to match expected dimensions
            if features.shape[1] < self.model.n_features_in_:
                # Pad with zeros
                padding = csr_matrix((1, self.model.n_features_in_ - features.shape[1]))
                features = hstack([features, padding])
            else:
                # Trim excess features
                features = features[:, :self.model.n_features_in_]
        
        # Predict risk level
        risk_prediction = self.model.predict(features)[0]
        probability = self.model.predict_proba(features)[0]
        
        # Get confidence
        confidence = max(probability)
        
        # Get rule-based classification for comparison
        rule_based_risk = self.classify_loan_purpose_risk(loan_purpose_text)
        
        return {
            'risk_level': risk_prediction,
            'confidence': round(confidence * 100, 2),
            'rule_based_risk': rule_based_risk,
            'vader_score': vader_scores['compound'],
            'purpose_preview': loan_purpose_text[:80] + '...' if len(loan_purpose_text) > 80 else loan_purpose_text,
            'model_vs_rule_match': risk_prediction == rule_based_risk,
            'feature_count': features.shape[1]
        }
    
    def predict_sentiment(self, text, channel='application'):
        """Predict sentiment of a message (for backward compatibility)"""
        # Get loan purpose risk prediction
        risk_result = self.predict_loan_purpose_risk(text, channel)
        
        # Convert risk to sentiment
        risk_to_sentiment = {
            'LOW': 'positive',
            'MEDIUM': 'neutral', 
            'HIGH': 'negative'
        }
        
        return {
            'sentiment': risk_to_sentiment.get(risk_result['risk_level'], 'neutral'),
            'confidence': risk_result['confidence'],
            'vader_score': risk_result.get('vader_score', 0),
            'text_preview': text[:80] + '...' if len(text) > 80 else text,
            'original_risk': risk_result
        }
    
    def analyze_member_loan_purposes(self, member_id):
        """Analyze loan purpose risk history for a specific member"""
        print(f"🔍 Analyzing loan purposes for member {member_id}...")
        
        # Load comments data
        comments_df = self.load_data()
        
        # Filter member's loan applications
        member_loans = comments_df[
            (comments_df['member_id'] == member_id) & 
            (comments_df['type'] == 'Loan Application')
        ].copy()
        
        if member_loans.empty:
            return {"error": f"No loan applications found for member {member_id}"}
        
        # Convert dates
        member_loans['send_date'] = pd.to_datetime(member_loans['send_date'])
        
        # Sort by date
        member_loans = member_loans.sort_values('send_date')
        
        # Analyze each loan purpose
        risk_results = []
        for _, loan in member_loans.iterrows():
            result = self.predict_loan_purpose_risk(
                loan['messageContent'], 
                loan.get('channel', 'application')
            )
            result['date'] = loan['send_date'].strftime('%Y-%m-%d') if not pd.isna(loan['send_date']) else 'Unknown'
            result['channel'] = loan.get('channel', 'application')
            risk_results.append(result)
        
        # Calculate overall risk profile
        risk_counts = {'LOW': 0, 'MEDIUM': 0, 'HIGH': 0}
        for result in risk_results:
            risk_counts[result['risk_level']] += 1
        
        total_loans = len(risk_results)
        if total_loans > 0:
            for risk in risk_counts:
                risk_counts[risk] = round(risk_counts[risk] / total_loans * 100, 2)
        
        # Determine overall risk indicator
        if risk_counts['HIGH'] > 50:
            overall_risk = "HIGH"
        elif risk_counts['HIGH'] > 20 or risk_counts['MEDIUM'] > 60:
            overall_risk = "MEDIUM"
        else:
            overall_risk = "LOW"
        
        return {
            'member_id': member_id,
            'total_loan_applications': total_loans,
            'risk_distribution': risk_counts,
            'overall_risk_indicator': overall_risk,
            'recent_loan_purposes': risk_results[-3:] if len(risk_results) > 3 else risk_results
        }
    
    def save_model(self, path='models/sentiment_analyzer.joblib'):
        """Save trained model with all components"""
        os.makedirs('models', exist_ok=True)
        joblib.dump({
            'model': self.model,
            'vectorizer': self.vectorizer,
            'channel_names': self.channel_names,  # Save channel names
            'sia': self.sia
        }, path)
        print(f"💾 Model saved to {path}")
    
    def load_model(self, path='models/sentiment_analyzer.joblib'):
        """Load trained model"""
        if not os.path.exists(path):
            raise FileNotFoundError(f"Model not found: {path}")
        
        loaded = joblib.load(path)
        self.model = loaded['model']
        self.vectorizer = loaded['vectorizer']
        self.channel_names = loaded.get('channel_names', None)
        self.sia = loaded.get('sia', SentimentIntensityAnalyzer())
        print(f"📂 Model loaded from {path}")
        if self.channel_names:
            print(f"📱 Loaded channel names: {self.channel_names}")

if __name__ == "__main__":
    print("📊 Loan Purpose Risk Analyzer Model")
    print("Run train.py to train the model.")