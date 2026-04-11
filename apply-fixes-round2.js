/**
 * Round 2 Systematic Fixes
 * 
 * This script documents all the fixes needed. The actual changes go into engine.js.
 * 
 * ISSUE CATEGORIES:
 * 
 * A) TOKENIZER: Single-char fragments leaking (107 occurrences)
 *    Root cause: _splitJapaneseSegment splits on particles, leaves fragments
 *    Fix: Before tokenizing, handle common grammar patterns at sentence level
 *    - Sentence-final particles: ね/よ/わ/か/な → drop (Arka has no equivalents)
 *    - だ/です copula at end → drop (handled by copula path)
 *    - ～ている/～ている → merge into single lookup
 *    - ～だったら/～たら conditional → handle
 *    - ～ますか/～ますか → strip polite suffix
 *    - じゃない → negative
 * 
 * B) MISSING VOCABULARY: 50+ words not in overrides
 *    天気, 帰る, 何時, 八時, コンビニ, 恐ろしい, 固い, etc.
 * 
 * C) KANSAI: normalizeKansai not catching all patterns
 *    Need more patterns and better regex
 * 
 * D) ご/お PREFIX: Length check too strict (>=3 fails on ご覧 etc)
 * 
 * E) SENTENCE-LEVEL GRAMMAR: Need pre-processing before tokenization
 *    - ～のだ/～なのだ → remove  
 *    - ～だっけ → remove
 *    - ～そう (seems like) → adjective handling
 *    - ～らしい (apparently) → drop
 */
