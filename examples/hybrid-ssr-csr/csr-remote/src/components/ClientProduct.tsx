// Client Component with interactivity
import React, { useState } from 'react';
import './ClientProduct.css';

interface ClientProductProps {
  id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  onAddToCart: (id: string) => void;
}

const ClientProduct: React.FC<ClientProductProps> = ({
  id,
  name,
  description,
  price,
  image = '/placeholder-product.jpg',
  onAddToCart,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [isHovered, setIsHovered] = useState(false);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setQuantity(value);
    }
  };

  const handleAddToCart = () => {
    // Call the parent handler
    onAddToCart(id);
    
    // Visual feedback
    const button = document.getElementById(`add-to-cart-${id}`);
    if (button) {
      button.textContent = 'Added to Cart!';
      setTimeout(() => {
        button.textContent = 'Add to Cart';
      }, 1500);
    }
  };

  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);

  return (
    <div 
      className="client-product"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="client-product-image-container">
        <img 
          src={image} 
          alt={name} 
          className={`client-product-image ${isHovered ? 'zoomed' : ''}`}
        />
        {isHovered && (
          <div className="quick-view-button">
            Quick View
          </div>
        )}
      </div>
      <div className="client-product-info">
        <h3 className="client-product-name">{name}</h3>
        <p className="client-product-description">{description}</p>
        <div className="client-product-price">{formattedPrice}</div>
        
        <div className="client-product-actions">
          <div className="quantity-control">
            <button 
              className="quantity-button"
              onClick={() => quantity > 1 && setQuantity(quantity - 1)}
            >
              -
            </button>
            <input 
              type="number" 
              min="1" 
              value={quantity} 
              onChange={handleQuantityChange}
              className="quantity-input"
            />
            <button 
              className="quantity-button"
              onClick={() => setQuantity(quantity + 1)}
            >
              +
            </button>
          </div>
          
          <button 
            id={`add-to-cart-${id}`}
            className="add-to-cart-button"
            onClick={handleAddToCart}
          >
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientProduct;