use std::collections::{HashMap, HashSet};

/// BM25 parameters.
const K1: f64 = 1.2;
const B: f64 = 0.75;

/// Basic English stopwords to filter from queries and documents.
const STOPWORDS: &[&str] = &[
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "do", "for", "from", "had", "has",
    "have", "he", "her", "him", "his", "how", "i", "if", "in", "into", "is", "it", "its", "just",
    "me", "my", "no", "not", "of", "on", "or", "our", "out", "so", "some", "than", "that", "the",
    "their", "them", "then", "there", "these", "they", "this", "to", "up", "us", "was", "we",
    "were", "what", "when", "which", "who", "will", "with", "would", "you", "your",
];

/// Tokenize text: lowercase, split on non-alphanumeric, filter stopwords and short tokens.
pub fn tokenize(text: &str) -> Vec<String> {
    let stops: HashSet<&str> = STOPWORDS.iter().copied().collect();
    text.to_lowercase()
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| t.len() >= 2 && !stops.contains(t))
        .map(String::from)
        .collect()
}

/// Inverted index for BM25 keyword scoring.
pub struct BM25Index {
    /// doc_id -> token list length
    doc_lengths: HashMap<String, usize>,
    /// Average document length across the corpus.
    avg_dl: f64,
    /// Total number of documents.
    num_docs: usize,
    /// term -> set of doc_ids containing this term (for IDF)
    doc_freq: HashMap<String, usize>,
    /// (term, doc_id) -> term frequency in that document
    term_freq: HashMap<(String, String), usize>,
    /// Ordered list of doc_ids (for deterministic output).
    doc_ids: Vec<String>,
}

impl BM25Index {
    /// Build the BM25 index from (doc_id, text) pairs.
    pub fn new(documents: &[(String, String)]) -> Self {
        let mut doc_lengths = HashMap::new();
        let mut doc_freq: HashMap<String, usize> = HashMap::new();
        let mut term_freq: HashMap<(String, String), usize> = HashMap::new();
        let mut doc_ids = Vec::with_capacity(documents.len());
        let mut total_len: usize = 0;

        for (doc_id, text) in documents {
            let tokens = tokenize(text);
            let len = tokens.len();
            doc_lengths.insert(doc_id.clone(), len);
            doc_ids.push(doc_id.clone());
            total_len += len;

            // Track which terms appear in this doc (for doc frequency).
            let mut seen_terms: HashSet<String> = HashSet::new();

            for token in &tokens {
                let key = (token.clone(), doc_id.clone());
                *term_freq.entry(key).or_insert(0) += 1;

                if seen_terms.insert(token.clone()) {
                    *doc_freq.entry(token.clone()).or_insert(0) += 1;
                }
            }
        }

        let num_docs = documents.len();
        let avg_dl = if num_docs > 0 {
            total_len as f64 / num_docs as f64
        } else {
            0.0
        };

        BM25Index {
            doc_lengths,
            avg_dl,
            num_docs,
            doc_freq,
            term_freq,
            doc_ids,
        }
    }

    /// Search the index with a query string, returning up to `top_k` (doc_id, score) pairs
    /// sorted by descending BM25 score.
    pub fn search(&self, query: &str, top_k: usize) -> Vec<(String, f64)> {
        let query_tokens = tokenize(query);
        if query_tokens.is_empty() {
            return Vec::new();
        }

        let mut scores: HashMap<&str, f64> = HashMap::new();

        for term in &query_tokens {
            // IDF component: log((N - df + 0.5) / (df + 0.5) + 1)
            let df = self.doc_freq.get(term).copied().unwrap_or(0) as f64;
            if df == 0.0 {
                continue;
            }
            let n = self.num_docs as f64;
            let idf = ((n - df + 0.5) / (df + 0.5) + 1.0).ln();

            for doc_id in &self.doc_ids {
                let tf = self
                    .term_freq
                    .get(&(term.clone(), doc_id.clone()))
                    .copied()
                    .unwrap_or(0) as f64;
                if tf == 0.0 {
                    continue;
                }
                let dl = self.doc_lengths.get(doc_id).copied().unwrap_or(0) as f64;
                let tf_norm = (tf * (K1 + 1.0)) / (tf + K1 * (1.0 - B + B * dl / self.avg_dl));
                *scores.entry(doc_id.as_str()).or_insert(0.0) += idf * tf_norm;
            }
        }

        let mut results: Vec<(String, f64)> = scores
            .into_iter()
            .map(|(id, score)| (id.to_string(), score))
            .collect();
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(top_k);
        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tokenize_basic() {
        let tokens = tokenize("Hello, World! This is a TEST.");
        // "this", "is", "a" are stopwords; "hello", "world", "test" remain
        assert!(tokens.contains(&"hello".to_string()));
        assert!(tokens.contains(&"world".to_string()));
        assert!(tokens.contains(&"test".to_string()));
        assert!(!tokens.contains(&"this".to_string()));
        assert!(!tokens.contains(&"is".to_string()));
        assert!(!tokens.contains(&"a".to_string()));
    }

    #[test]
    fn test_tokenize_filters_short_tokens() {
        let tokens = tokenize("I x am y ok z");
        // "i" is a stopword, "x", "y", "z" are < 2 chars, "am" is 2 chars and not a stopword
        assert!(tokens.contains(&"am".to_string()));
        assert!(tokens.contains(&"ok".to_string()));
        assert!(!tokens.contains(&"x".to_string()));
    }

    #[test]
    fn test_matching_doc_scores_higher() {
        let docs = vec![
            ("doc1".to_string(), "Rust programming language systems".to_string()),
            ("doc2".to_string(), "Cooking recipes for pasta and pizza".to_string()),
        ];
        let index = BM25Index::new(&docs);
        let results = index.search("rust programming", 10);

        assert!(!results.is_empty());
        assert_eq!(results[0].0, "doc1");
        // doc2 should either not appear or score lower
        if results.len() > 1 {
            assert!(results[0].1 > results[1].1);
        }
    }

    #[test]
    fn test_empty_query_returns_empty() {
        let docs = vec![("doc1".to_string(), "hello world".to_string())];
        let index = BM25Index::new(&docs);
        let results = index.search("", 10);
        assert!(results.is_empty());
    }

    #[test]
    fn test_stopword_only_query_returns_empty() {
        let docs = vec![("doc1".to_string(), "the quick brown fox".to_string())];
        let index = BM25Index::new(&docs);
        let results = index.search("the is a", 10);
        assert!(results.is_empty());
    }

    #[test]
    fn test_no_matching_term_returns_empty() {
        let docs = vec![("doc1".to_string(), "hello world".to_string())];
        let index = BM25Index::new(&docs);
        let results = index.search("zzzzzzz", 10);
        assert!(results.is_empty());
    }

    #[test]
    fn test_top_k_limits_results() {
        let docs = vec![
            ("doc1".to_string(), "rust rust rust".to_string()),
            ("doc2".to_string(), "rust python".to_string()),
            ("doc3".to_string(), "rust go java".to_string()),
        ];
        let index = BM25Index::new(&docs);
        let results = index.search("rust", 2);
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_term_frequency_matters() {
        // A doc with the term repeated more should score higher.
        let docs = vec![
            ("doc1".to_string(), "rust".to_string()),
            ("doc2".to_string(), "rust rust rust rust rust".to_string()),
        ];
        let index = BM25Index::new(&docs);
        let results = index.search("rust", 10);
        assert_eq!(results.len(), 2);
        // doc2 has higher TF
        assert_eq!(results[0].0, "doc2");
        assert!(results[0].1 > results[1].1);
    }

    #[test]
    fn test_empty_corpus() {
        let docs: Vec<(String, String)> = vec![];
        let index = BM25Index::new(&docs);
        let results = index.search("anything", 10);
        assert!(results.is_empty());
    }
}
