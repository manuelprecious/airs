import React, { useRef, useCallback, useEffect } from 'react';

const Sparkline = React.memo(({ data, color }) => {
  const canvasRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.offsetWidth;
      canvas.height = container.offsetHeight;
    } else {
      canvas.width = 300;
      canvas.height = 40;
    }

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (data.length === 0) return;

    const minVal = Math.min(...data);
    const maxVal = Math.max(...data);
    const range = maxVal - minVal;
    const scaleY = (y) => height - ((y - minVal) / (range > 0 ? range : 1)) * height;
    const scaleX = (x) => (x / (data.length - 1)) * width;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    data.forEach((value, index) => {
      if (index === 0) {
        ctx.moveTo(scaleX(index), scaleY(value));
      } else {
        ctx.lineTo(scaleX(index), scaleY(value));
      }
    });

    ctx.stroke();
  }, [data, color]);

  useEffect(() => {
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(draw, 100);
    };
    
    draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data, color, draw]);

  return (
    <canvas 
      ref={canvasRef} 
      className="sparkline-canvas" 
      style={{ width: '100%', height: '100%' }} 
    />
  );
});

export default Sparkline;