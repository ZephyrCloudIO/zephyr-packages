import React, { useState, useEffect } from 'react';
import './ClientCarousel.css';

interface CarouselItem {
  id: string;
  image: string;
  title: string;
}

interface ClientCarouselProps {
  items: CarouselItem[];
  autoPlay?: boolean;
  interval?: number;
}

const ClientCarousel: React.FC<ClientCarouselProps> = ({
  items,
  autoPlay = true,
  interval = 5000,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Handle auto-play
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (autoPlay && items.length > 1) {
      timer = setInterval(() => {
        goToNext();
      }, interval);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [autoPlay, interval, activeIndex, items.length]);

  // Navigation functions
  const goToSlide = (index: number) => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    setActiveIndex(index);
    
    // Reset transition state after animation
    setTimeout(() => {
      setIsTransitioning(false);
    }, 500); // Match transition duration in CSS
  };

  const goToPrev = () => {
    const newIndex = activeIndex === 0 ? items.length - 1 : activeIndex - 1;
    goToSlide(newIndex);
  };

  const goToNext = () => {
    const newIndex = activeIndex === items.length - 1 ? 0 : activeIndex + 1;
    goToSlide(newIndex);
  };

  // Touch handlers for swipe functionality
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;
    
    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrev();
    }
    
    // Reset values
    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <div 
      className="client-carousel"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="carousel-container">
        <button className="carousel-arrow prev" onClick={goToPrev}>
          &lt;
        </button>
        
        <div className="carousel-slides">
          <div 
            className="slides-track" 
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            {items.map((item, index) => (
              <div key={item.id} className="slide">
                <img 
                  src={item.image} 
                  alt={item.title} 
                  className="slide-image"
                  loading="lazy"
                />
                <div className="slide-caption">
                  <h3>{item.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <button className="carousel-arrow next" onClick={goToNext}>
          &gt;
        </button>
      </div>
      
      <div className="carousel-indicators">
        {items.map((_, index) => (
          <button
            key={index}
            className={`indicator-dot ${index === activeIndex ? 'active' : ''}`}
            onClick={() => goToSlide(index)}
          />
        ))}
      </div>
    </div>
  );
};

export default ClientCarousel;