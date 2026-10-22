# Research model feature data dictionary

This allowlist is the only feature vocabulary accepted by the research trainer and assessment inference adapter. Values are computed from saved task responses; participant demographics, clinician scores, identifiers, and MRI fields are excluded. These are data representations for research evaluation, not validated clinical measurements.

## Cognitive task modality

| Name | Type | Source | Meaning and missingness |
|---|---|---|---|
| `memory_recall_count` | integer | Memory response | Unique recalled words matching the shown list; unavailable response currently derives as zero only when an actual memory response is present. |
| `memory_presented_count` | integer | Memory response | Number of unique words presented; missing if no words were saved. |
| `attention_correct_count` | integer | Attention task | Recorded correct target responses. |
| `attention_incorrect_count` | integer | Attention task | Recorded premature/incorrect responses. |
| `attention_missed_count` | integer | Attention task | Targets not responded to before timeout. |
| `attention_mean_reaction_time_ms` | number | Attention task | Mean observed browser reaction time for valid responses; null if no response times. Device timing is uncalibrated. |
| `orientation_correct_count` | integer | Orientation task | Number of date items matching the submitted task date; not a diagnosis score. |
| `orientation_scored_count` | integer | Orientation task | Number of date items scored; place is not scored. |
| `language_sentence_character_count` | integer | Language task | Character count of the submitted sentence. |
| `language_list_response_count` | integer | Language task | Number of non-empty comma/semicolon/newline-separated list entries; not semantic scoring. |

The profile's age/sex, clinician MMSE/CDR, socioeconomic context, and any MRI-derived fields are intentionally not present in the inference vocabulary. The API derives features from an authenticated user's own saved assessment. It rejects direct feature payloads.

## Speech modality

| Name | Type | Source | Meaning and missingness |
|---|---|---|---|
| `voice_audio_duration_seconds` | number | Transcription metadata | Transcriber-reported recording duration; null if unavailable. |
| `voice_speaking_duration_seconds` | number | Timed transcript segments | Sum of valid segment spans; null without valid timed segments. |
| `voice_transcript_word_count` | integer | Transcript | General Unicode token count; language-specific validity is not established. |
| `voice_transcript_character_count` | integer | Transcript | Non-whitespace transcript character count. |
| `voice_speech_rate_words_per_minute` | number | Transcript + timed segments | Word count per speaking minute; null unless valid timed speech spans at least two seconds. |
| `voice_pause_count` | integer | Timed transcript segments | Count of positive gaps between valid sequential segments; null if no valid segments. |
| `voice_mean_pause_seconds` | number | Timed transcript segments | Mean positive observed gap; null if no positive gap exists. |
| `voice_maximum_pause_seconds` | number | Timed transcript segments | Maximum positive observed gap; null if no positive gap exists. |

Speech features are derived from the automatic transcript, not directly from acoustic signals. They can be affected by transcription errors and are not validated biomarkers. The trainer requires one modality per model; no fusion schema is supported.
