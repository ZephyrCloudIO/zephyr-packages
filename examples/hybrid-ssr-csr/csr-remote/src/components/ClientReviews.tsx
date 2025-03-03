import React, { useState, useEffect } from 'react';
import './ClientReviews.css';

interface Review {
  id: string;
  author: string;
  rating: number;
  content: string;
  date: string;
}

interface ClientReviewsProps {
  productId: string;
}

const ClientReviews: React.FC<ClientReviewsProps> = ({ productId }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newReview, setNewReview] = useState({
    author: '',
    rating: 5,
    content: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Fetch reviews
  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        
        // Simulate API call with timeout
        setTimeout(() => {
          // Mock data based on productId
          const mockReviews: Review[] = Array.from({ length: 5 }, (_, i) => ({
            id: `review-${productId}-${i}`,
            author: `User ${Math.floor(Math.random() * 1000)}`,
            rating: Math.floor(Math.random() * 5) + 1,
            content: `This is a review for product ${productId}. ${
              i % 2 === 0 
                ? 'I really enjoyed this product!' 
                : 'It was decent, but could be better in some ways.'
            } ${
              i % 3 === 0 
                ? 'Would definitely recommend to others.' 
                : 'Might buy again in the future.'
            }`,
            date: new Date(Date.now() - i * 86400000).toLocaleDateString()
          }));
          
          setReviews(mockReviews);
          setLoading(false);
        }, 1000);
      } catch (err) {
        setError('Failed to load reviews. Please try again later.');
        setLoading(false);
      }
    };

    fetchReviews();
  }, [productId]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewReview(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle rating change
  const handleRatingChange = (rating: number) => {
    setNewReview(prev => ({
      ...prev,
      rating
    }));
  };

  // Submit new review
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newReview.author || !newReview.content) {
      setError('Please fill in all fields');
      return;
    }
    
    setSubmitting(true);
    setError(null);
    
    // Simulate API call
    setTimeout(() => {
      const newReviewObj: Review = {
        id: `review-${productId}-${Date.now()}`,
        author: newReview.author,
        rating: newReview.rating,
        content: newReview.content,
        date: new Date().toLocaleDateString()
      };
      
      setReviews(prev => [newReviewObj, ...prev]);
      setNewReview({
        author: '',
        rating: 5,
        content: ''
      });
      setSubmitting(false);
      setSubmitSuccess(true);
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 3000);
    }, 1000);
  };

  // Render star rating
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span 
        key={i} 
        className={`star ${i < rating ? 'filled' : 'empty'}`}
      >
        ★
      </span>
    ));
  };

  // Render interactive star input
  const renderStarInput = () => {
    return Array.from({ length: 5 }, (_, i) => (
      <span 
        key={i} 
        className={`star interactive ${i < newReview.rating ? 'filled' : 'empty'}`}
        onClick={() => handleRatingChange(i + 1)}
      >
        ★
      </span>
    ));
  };

  return (
    <div className="client-reviews">
      <h2 className="reviews-title">Customer Reviews</h2>
      
      {/* Review Form */}
      <div className="review-form-container">
        <h3>Write a Review</h3>
        <form onSubmit={handleSubmit} className="review-form">
          <div className="form-group">
            <label htmlFor="author">Your Name</label>
            <input
              type="text"
              id="author"
              name="author"
              value={newReview.author}
              onChange={handleInputChange}
              placeholder="Enter your name"
            />
          </div>
          
          <div className="form-group">
            <label>Rating</label>
            <div className="rating-input">
              {renderStarInput()}
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="content">Review</label>
            <textarea
              id="content"
              name="content"
              value={newReview.content}
              onChange={handleInputChange}
              placeholder="Share your thoughts about this product"
              rows={4}
            />
          </div>
          
          {error && <div className="error-message">{error}</div>}
          {submitSuccess && <div className="success-message">Review submitted successfully!</div>}
          
          <button 
            type="submit" 
            className="submit-button"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      </div>
      
      {/* Reviews List */}
      <div className="reviews-list">
        <h3>All Reviews ({reviews.length})</h3>
        
        {loading ? (
          <div className="loading-reviews">Loading reviews...</div>
        ) : reviews.length > 0 ? (
          reviews.map(review => (
            <div key={review.id} className="review-item">
              <div className="review-header">
                <span className="review-author">{review.author}</span>
                <span className="review-date">{review.date}</span>
              </div>
              <div className="review-rating">
                {renderStars(review.rating)}
              </div>
              <p className="review-content">{review.content}</p>
            </div>
          ))
        ) : (
          <div className="no-reviews">No reviews yet. Be the first to review!</div>
        )}
      </div>
    </div>
  );
};

export default ClientReviews;