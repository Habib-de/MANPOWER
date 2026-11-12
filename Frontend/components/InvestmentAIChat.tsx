// components/InvestmentAIChat.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getInvestmentAdvice, InvestmentContext } from '../services/geminiService';

const { width, height } = Dimensions.get('window');

// Minimal Color System - Less Colorful
const COLORS = {
  primary: '#5B6C8F',
  primaryLight: '#7A8AA8',
  primaryDark: '#4A5A7A',
  success: '#6B8F7C',
  warning: '#C4A86B',
  danger: '#C47A7A',
  gradientStart: '#6B7A9A',
  gradientEnd: '#5A6A8A',
  chatBg: '#F7F8FA',
  userBubble: '#E8EBF0',
  aiBubble: '#FFFFFF',
  text: {
    primary: '#2C3A4A',
    secondary: '#5A6A7A',
    tertiary: '#8A9AA8',
    light: '#B0C0CE',
  },
  border: '#E4E8ED',
  shadow: 'rgba(44, 58, 74, 0.08)',
};

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isTyping?: boolean;
}

interface InvestmentAIChatProps {
  visible: boolean;
  onClose: () => void;
  context: InvestmentContext;
}

// Typing Animation Component - Subtle
const TypingIndicator = () => {
  const [dots] = useState(new Animated.Value(0));
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dots, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
        Animated.timing(dots, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.ease),
        }),
      ])
    ).start();
  }, []);

  const dotStyle = (index: number) => ({
    opacity: dots.interpolate({
      inputRange: [0, 0.3, 0.6, 1],
      outputRange: [0.3, 1, 0.3, 0.3],
    }),
  });

  return (
    <View style={styles.typingContainer}>
      <View style={styles.typingBubble}>
        <Animated.View style={[styles.typingDot, dotStyle(0)]} />
        <Animated.View style={[styles.typingDot, dotStyle(1)]} />
        <Animated.View style={[styles.typingDot, dotStyle(2)]} />
      </View>
    </View>
  );
};

export default function InvestmentAIChat({ visible, onClose, context }: InvestmentAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "👋 Hi! I'm your AI Investment Advisor. I can help you with:\n\n• Investment recommendations\n• Portfolio analysis\n• Risk assessment\n• Diversification strategies\n• Market insights\n\nWhat would you like to know?",
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // Load user name on mount
  useEffect(() => {
    const loadUserName = async () => {
      try {
        const firstName = await AsyncStorage.getItem('userFirstName');
        const lastName = await AsyncStorage.getItem('userLastName');
        if (firstName && lastName) {
          setUserName(`${firstName} ${lastName}`);
        } else if (firstName) {
          setUserName(firstName);
        }
      } catch (error) {
        console.error('Failed to load user name:', error);
      }
    };
    loadUserName();
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
      ]).start();
      scrollToBottom();
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      scrollToBottom();
    }
  }, [messages, visible]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 200);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || loading) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = inputText.trim();
    setInputText('');
    setLoading(true);
    setIsTyping(true);

    try {
      // Check if it's a greeting
      const greetingPatterns = [
        /^(hi|hello|hey|good morning|good afternoon|good evening|greetings|howdy|sup|yo|what's up|wassup)/i,
        /^(how are you|how's it going|how do you do|nice to meet you)/i,
        /^(thanks|thank you|thx|appreciate it)/i,
      ];
      
      const isGreeting = greetingPatterns.some(pattern => pattern.test(userInput));
      
      // Check if it's investment-related
      const investmentKeywords = [
        'invest', 'portfolio', 'stock', 'bond', 'fund', 'risk', 'return', 
        'market', 'diversify', 'asset', 'saving', 'financial', 'money', 
        'cash', 'profit', 'loss', 'growth', 'interest', 'dividend', 
        'equity', 'mutual', 'etf', 'reit', 'real estate', 'commodity', 
        'currency', 'inflation', 'tax', 'wealth', 'capital', 'income',
        'retirement', 'pension', '401k', 'ira', 'crypto', 'bitcoin',
        'forex', 'trading', 'investment', 'advisor', 'advice', 'help'
      ];
      
      const isInvestmentRelated = investmentKeywords.some(keyword => 
        userInput.toLowerCase().includes(keyword.toLowerCase())
      );

      let finalResponse = '';

      // Simulate typing delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

      // If it's a greeting and not investment-related
      if (isGreeting && !isInvestmentRelated) {
        const greetingResponses = [
          `👋 Hello ${userName || 'there'}! How can I help you with your investments today?`,
          `Hi ${userName || 'there'}! 👋 Ready to explore some investment opportunities?`,
          `Hey ${userName || 'there'}! 👋 What would you like to know about your portfolio?`,
          `Hello ${userName || 'there'}! 👋 I'm here to help you make smart investment decisions.`
        ];
        finalResponse = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
      }
      // If it's not investment-related and not a greeting
      else if (!isInvestmentRelated && !isGreeting) {
        const offTopicResponses = [
          "🤔 I'm not sure I understand. I specialize in investment advice, portfolio analysis, and financial planning. Could you please ask about:\n\n• Investment recommendations\n• Portfolio performance\n• Risk assessment\n• Diversification strategies\n• Market insights\n\nWhat would you like to know?",
          "😅 That's outside my expertise! I'm an AI Investment Advisor, so I can help with:\n\n• Stocks, bonds, and mutual funds\n• Portfolio diversification\n• Risk management\n• Market analysis\n\nFeel free to ask about any of these topics!",
          "🤷‍♂️ I don't quite understand that. As your AI Investment Advisor, I'm best at:\n\n• Suggesting investment opportunities\n• Analyzing portfolio performance\n• Assessing financial risks\n• Providing market insights\n\nWhat investment-related question can I answer for you?"
        ];
        finalResponse = offTopicResponses[Math.floor(Math.random() * offTopicResponses.length)];
      }
      // If it's investment-related, get advice from Gemini
      else {
        // If it's a greeting and investment-related, combine them
        if (isGreeting && isInvestmentRelated) {
          const combinedGreeting = `👋 Hello ${userName || 'there'}! Let me help with that:\n\n`;
          const advice = await getInvestmentAdvice(userInput, context);
          finalResponse = combinedGreeting + advice;
        } else {
          const advice = await getInvestmentAdvice(userInput, context);
          // Check if the advice is empty or too short
          if (!advice || advice.length < 20) {
            finalResponse = "🤔 I need more context to give you good advice. Could you please provide more details about what you're looking for?";
          } else {
            finalResponse = advice;
          }
        }
      }

      setIsTyping(false);

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: finalResponse,
        sender: 'ai',
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, aiMessage]);
      
    } catch (error) {
      setIsTyping(false);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: '❌ Sorry, I encountered an error. Please try again.',
        sender: 'ai',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  const renderMessage = (message: Message) => {
    const isUser = message.sender === 'user';
    const isFirstMessage = message.id === '1';
    
    return (
      <Animated.View 
        style={[
          styles.messageRow, 
          isUser ? styles.userRow : styles.aiRow,
          isFirstMessage && styles.firstMessage
        ]}
      >
        {!isUser && (
          <View style={styles.aiAvatar}>
            <Text style={styles.aiAvatarText}>🤖</Text>
          </View>
        )}
        
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
          {!isUser && (
            <Text style={styles.aiBadgeText}>Assistant</Text>
          )}
          <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
            {message.text}
          </Text>
          <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.aiTimestamp]}>
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        
        {isUser && (
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>👤</Text>
          </View>
        )}
      </Animated.View>
    );
  };

  const quickQuestions = [
    'What should I invest in?',
    'How is my portfolio performing?',
    'Suggest diversification strategy',
    'What are the risks?',
  ];

  const suggestionChips = [
    'Portfolio Analysis',
    'Stock Recommendations',
    'Mutual Funds',
    'Real Estate',
    'Risk Assessment',
    'Market Insights',
  ];

  return (
    <Modal
      animationType="fade"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <Animated.View 
          style={[
            styles.contentContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          {/* Header - Minimal */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>AI Investment Advisor</Text>
              <View style={styles.headerStatus}>
                <View style={styles.statusDot} />
                <Text style={styles.headerSubtitle}>Powered by Gemini AI</Text>
              </View>
            </View>
            <View style={styles.headerRight} />
          </View>

          {/* Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            {messages.map((message) => (
              <View key={message.id}>
                {renderMessage(message)}
              </View>
            ))}
            {isTyping && <TypingIndicator />}
            {loading && !isTyping && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingText}>Processing...</Text>
              </View>
            )}
          </ScrollView>

          {/* Quick Questions */}
          {messages.length <= 2 && (
            <View style={styles.quickQuestionsContainer}>
              <Text style={styles.quickQuestionsTitle}>Quick Questions</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickQuestionsContent}
              >
                {quickQuestions.map((q, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.quickQuestionButton}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setInputText(q);
                      setTimeout(handleSendMessage, 300);
                    }}
                  >
                    <Text style={styles.quickQuestionText}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Suggestion Chips */}
          {messages.length <= 4 && (
            <View style={styles.suggestionContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionContent}
              >
                {suggestionChips.map((chip, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionChip}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setInputText(chip);
                      setTimeout(handleSendMessage, 300);
                    }}
                  >
                    <Text style={styles.suggestionChipText}>{chip}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Input */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Ask about investments..."
                  placeholderTextColor={COLORS.text.light}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
                  onPress={handleSendMessage}
                  disabled={!inputText.trim() || loading}
                >
                  <Ionicons 
                    name="send" 
                    size={20} 
                    color={!inputText.trim() || loading ? COLORS.text.light : '#fff'} 
                  />
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    padding: 4,
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.text.primary,
    letterSpacing: -0.3,
  },
  headerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.success,
  },
  headerSubtitle: {
    fontSize: 11,
    color: COLORS.text.tertiary,
  },
  headerRight: {
    width: 40,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: COLORS.chatBg,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  userRow: {
    justifyContent: 'flex-end',
  },
  aiRow: {
    justifyContent: 'flex-start',
  },
  firstMessage: {
    marginTop: 8,
  },
  messageBubble: {
    maxWidth: '82%',
    padding: 14,
    borderRadius: 16,
    elevation: 1,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  userBubble: {
    backgroundColor: COLORS.userBubble,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: COLORS.aiBubble,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: COLORS.text.primary,
  },
  aiText: {
    color: COLORS.text.primary,
  },
  timestamp: {
    fontSize: 9,
    marginTop: 6,
    letterSpacing: 0.2,
  },
  userTimestamp: {
    color: COLORS.text.tertiary,
    textAlign: 'right',
  },
  aiTimestamp: {
    color: COLORS.text.tertiary,
    textAlign: 'right',
  },
  aiBadgeText: {
    fontSize: 9,
    color: COLORS.text.tertiary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.userBubble,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  userAvatarText: {
    fontSize: 14,
  },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.aiBubble,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  aiAvatarText: {
    fontSize: 14,
  },
  typingContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingLeft: 42,
  },
  typingBubble: {
    flexDirection: 'row',
    backgroundColor: COLORS.aiBubble,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.text.tertiary,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: 42,
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: COLORS.text.tertiary,
  },
  quickQuestionsContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  quickQuestionsTitle: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.text.tertiary,
    marginBottom: 8,
    paddingHorizontal: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickQuestionsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickQuestionButton: {
    backgroundColor: COLORS.chatBg,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickQuestionText: {
    fontSize: 13,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  suggestionContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  suggestionContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: COLORS.chatBg,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  suggestionChipText: {
    fontSize: 12,
    color: COLORS.text.secondary,
    fontWeight: '500',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: COLORS.chatBg,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  sendButtonDisabled: {
    backgroundColor: COLORS.chatBg,
    elevation: 0,
    shadowOpacity: 0,
  },
});