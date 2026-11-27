Build URIMAI – Your Voice. Your Rights. Your Benefits.

Build a working, mobile-first prototype of URIMAI, a multilingual, voice-first government benefits companion that helps underserved people in India discover benefits they may qualify for and complete the application journey through conversation.

1. Target users and languages
Design for elderly people, widows, low-income families and people with limited literacy or digital skills, initially focusing on rural and semi-urban India. For prototype, support only a few as mentioned below
Support the complete experience in four languages:
Tamil, including natural conversational Tamil
Hindi
Telugu
English
Allow language switching and natural language mixing, such as Tamil-English, wherever supported. Use separate speech-to-text and text-to-speech services within the app. Wispr Flow is a tool for builders, not the app's speech engine.

2. Core voice journey
Create a simple interface with a prominent microphone, spoken responses, visible transcripts, large text and easy controls. Ask one question at a time.

Step 1 – Welcome: Greet the user and let them choose or speak their preferred language.

Step 2 – Understand: Ask what help they need. Let them describe their circumstances naturally. For example: "எனக்கு 58 வயசு. என் கணவர் இறந்து ஐந்து வருஷம் ஆகுது. எனக்கு ஏதாவது அரசு உதவி கிடைக்குமா?" Identify relevant details such as age, location and household circumstances. Ask only necessary follow-up questions.

Step 3 – Confirm: Read back important details and display them. Allow users to correct mistakes through voice. Never assume critical information.

Step 4 – Discover: Match confirmed information against verified government scheme rules. Explain why a scheme may apply and identify anything that needs further checking. Show three outcomes: potentially eligible, more information required, or appears ineligible. Never guarantee eligibility or approval.

Step 5 – Prepare: Explain required documents one at a time. Identify missing documents and explain how to obtain them using verified information.

Step 6 – Fill applications: Ask application questions conversationally. Convert spoken answers into the relevant form fields, explain unfamiliar questions, identify missing information and read back important details. Allow corrections and require confirmation.

Step 7 – Review and submit: Show the completed application for review. Support actual submission only where an authorised integration exists. Otherwise, guide the user through the official submission channel without claiming to submit it.

Step 8 – Resume: With consent, save the user's profile, selected scheme, document checklist, form progress and pending actions. When they return and ask what to do next, resume from where they stopped.

3. Handle real-world voice problems

Implement recovery behaviour for:
Background noise: Detect unclear speech and ask the user to repeat without losing context.
Regional accents: Handle supported pronunciation variations; ask for clarification rather than guessing.
Mixed languages: Recognise supported Tamil-English, Hindi-English and Telugu-English speech.
Misheard words: Display the transcript, read back important details and allow corrections.
Silence: Wait patiently, repeat the question simply and offer tap-to-record.
Speech failure: Allow another attempt or optional text input without losing progress.
Language switching: Retain the user's profile and journey.
Network failure: Explain the interruption and preserve saved progress.
Never silently change or assume critical details such as age, income or location.

4. Build and data requirements

Create four sections: Home, Discover Benefits, My Journey and My Profile.
Include 5–8 verified central and Tamil Nadu schemes. Store each scheme's official source, eligibility rules, benefits, required documents, application instructions and last-verified date.
Use structured rules for eligibility checks. Use AI to understand conversations and explain results, not to invent eligibility criteria. Clearly disclose missing or outdated information.
Implement persistent journeys, editable profiles, consent before saving personal information and an option to delete saved data. Do not request Aadhaar numbers, OTPs or bank credentials just for benefit discovery.
Do not claim official document verification or application-status tracking without genuine integrations. Clearly distinguish user-reported progress from verified government status.
Ensure the prototype works on mobile devices and communicates speech or network limitations honestly.

Success criterion: A Tamil-speaking user can discover a potentially relevant benefit, understand the requirements, fill an application through conversation, review their answers, save progress and return to continue. Demonstrate the same core journey in all four languages.