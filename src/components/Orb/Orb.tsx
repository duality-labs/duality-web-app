import React, { useEffect, useState } from 'react';

import './Orb.scss';

interface Bubble {
  diameter: number;
  id: string;
  left: number;
  top: number;
}

interface OrbProps {
  scaleRatio: number;
  radius: number;
  left: number;
  top: number;
}

const minDiameter = 15,
  maxDiameter = 40;

// average amount of bubbles every 100px by 100px
const averageBubbles = 3;
const minBubbles = 1;
const maxBubbles = 100;

let idCounter = 0;

export default function Orbs({ radius, left, top, scaleRatio }: OrbProps) {
  const [bubbleCount, setBubbleCount] = useState(calcualteBubbleCount(radius));
  const [bubbles, setBubbles] = useState<Array<Bubble>>(
    getBubbleList(bubbleCount, radius)
  );

  useEffect(
    function () {
      setBubbles(function (oldBubbles) {
        const emptyList = '0'
          .repeat(Math.min(maxBubbles, bubbleCount))
          .split('');
        return emptyList.map(function (_, index) {
          return oldBubbles[index] ?? createNewBubble(radius);
        });
      });
    },
    [bubbleCount, radius]
  );

  useEffect(
    function () {
      setBubbleCount(calcualteBubbleCount(radius));
    },
    [radius]
  );

  function getBubble(bubbleInfo: Bubble) {
    return (
      <div
        key={bubbleInfo.id}
        className="bubble"
        ref={startBubbleAnimation}
        onTransitionEnd={onAnimationEnd}
        style={{
          top: bubbleInfo.top,
          left: bubbleInfo.left,
          width: bubbleInfo.diameter,
          height: bubbleInfo.diameter,
        }}
      ></div>
    );

    function onAnimationEnd(event: React.TransitionEvent) {
      if (event.propertyName !== 'margin-top') return;
      setBubbles(function (bubbles) {
        const index = bubbles.indexOf(bubbleInfo);
        if (index !== -1) bubbles.splice(index, 1);
        return bubbles;
      });
      setBubbleCount(calcualteBubbleCount(radius));
    }
  }

  return (
    <div
      className="orb-container counter-rotate-slow"
      style={{
        height: radius * 2,
        width: radius * 2,
        left: left,
        top: top,
      }}
    >
      <div
        className="orb y-expand"
        style={{ '--scale-ratio': scaleRatio } as React.CSSProperties}
      >
        {bubbles.map(getBubble)}
      </div>
    </div>
  );
}

function calcualteBubbleCount(radius: number) {
  // calculated as a square rather than a circle for better randomness
  const area = Math.pow(radius * 2, 2);
  const multiplier = (averageBubbles * area) / (100 * 100);
  const count = Math.round(Math.random() * multiplier);
  return Math.min(Math.max(count, minBubbles), maxBubbles);
}

function getBubbleList(count: number, radius: number) {
  const emptyList = '0'.repeat(Math.min(maxBubbles, count)).split('');
  return emptyList.map(createNewBubble.bind(null, radius));
}

function createNewBubble(radius: number) {
  const orbDiameter = radius * 2;
  const left = Math.round(Math.random() * orbDiameter);
  const top = Math.round(Math.random() * orbDiameter);
  const diameterGap = maxDiameter - minDiameter;
  const diameter = Math.random() * diameterGap + minDiameter;
  const id = `${idCounter++}`;
  return { left, top, diameter, id };
}

function startBubbleAnimation(dom: HTMLDivElement | null) {
  setTimeout(function () {
    dom?.classList?.add('bubbling');
  }, 1e3);
}
