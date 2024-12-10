const SHOULD_LOG = false;

function maybeLog(...args) {
  if (SHOULD_LOG) {
    console.log(args);
  }
}

const DECK_ORDERED = [
  "_2", "_3", "_4", "_5", "_6", "_7", "_8", "_9", "_10", "_11", "_12", "_13", "_14",
  "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10", "a11", "a12", "a13", "a14",
  "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9", "b10", "b11", "b12", "b13", "b14",
  "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10", "c11", "c12", "c13", "c14",
]
const TRUMP_SUIT = "_";
const ALL_SUITS = ["_", "a", "b", "c"];
const NON_TRUMP_SUITS = ["a", "b", "c"];



function getSuit(card) {
  return card[0];
}

function getNumber(card) {
  return parseInt(card.slice(1));
}

// Context: Players 0 and 2 are partners. Play goes in order 0, 1, 2, 3 and looping. Teams are 0 (for 0+2) and 1 (for 1+3).
// Game-scoped variables
let g_startingHands, g_hands, g_score, g_playedCards, g_highestUnplayedCard, g_whoCuts;
// Round-scoped variables
let r_leadingPlayer, r_leadSuit, r_isCut, r_highestNumPlayed, r_winningPlayer;

/* Randomize array in-place using Durstenfeld shuffle algorithm */
function shuffleArray(array) {
  for (var i = array.length - 1; i >= 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

function setup() {
  g_hands = [[], [], [], []];
  g_score = [0, 0];
  g_playedCards = new Set();
  g_highestUnplayedCard = { "_": 14, "a": 14, "b": 14, "c": 14 };
  g_whoCuts = { "_": [], "a": [], "b": [], "c": [] };
  r_leadingPlayer = 0; // King starts

  // Shuffle the deck
  const deck = [...DECK_ORDERED];
  shuffleArray(deck);
  for (let i = 0; i < DECK_ORDERED.length; i++) {
    const playerIndex = i % 4;
    g_hands[playerIndex].push(deck.pop());
  }
  g_hands.forEach(x => x.sort());
  g_startingHands = JSON.parse(JSON.stringify(g_hands));
}

function leadWithCard(card) {
  // Set all round-scoped variables
  r_leadSuit = getSuit(card);
  r_highestNumPlayed = getNumber(card);
  r_isCut = false;
  r_winningPlayer = r_leadingPlayer;

  playCard(card, r_leadingPlayer);
}

function followWithCard(card, playerIndex) {
  playCard(card, playerIndex);

  const suit = getSuit(card);
  const number = getNumber(card);

  let didTakeLead = false;
  if (!r_isCut && suit == r_leadSuit && number > r_highestNumPlayed) {
    // One-upped on-suit
    didTakeLead = true;
  } else if (!r_isCut && suit == TRUMP_SUIT && r_leadSuit != TRUMP_SUIT) {
    // First time cut
    r_isCut = true;
    didTakeLead = true;
  } else if (r_isCut && suit == TRUMP_SUIT && number > r_highestNumPlayed) {
    // Out-trumped
    didTakeLead = true;
  }
  if (didTakeLead) {
    r_highestNumPlayed = number;
    r_winningPlayer = playerIndex;
  }
}

function playCard(card, playerIndex) {
  const suit = getSuit(card);
  const number = getNumber(card);

  // Remove the card from the player's hand
  const index = g_hands[playerIndex].indexOf(card);
  if (index > -1) {
    g_hands[playerIndex].splice(index, 1); // 2nd parameter means remove one item only
  } else {
    console.log("ERROR: tried to play card that wasn't in hand", card, g_hands[playerIndex]);
  }

  g_playedCards.add(card);

  // Maybe update the highest unplayed card tracker
  if (number == g_highestUnplayedCard[suit]) {
    g_highestUnplayedCard[suit] -= 1;
    // If the next highest card was played earlier, keep lowering it
    while (g_playedCards.has(suit + g_highestUnplayedCard[suit])) {
      g_highestUnplayedCard[suit] -= 1;
    }
  }

  // Maybe update who cuts
  if (r_leadSuit != TRUMP_SUIT && suit != r_leadSuit) {
    if (!g_whoCuts[r_leadSuit].includes(playerIndex)) {
      g_whoCuts[r_leadSuit].push(playerIndex);
    }
  }

  maybeLog("-- Player", playerIndex, "played card", card);
}

function getHighestCard(cardList) {
  if (cardList.length == 0) {
    console.log("ERROR: requested highest card of empty list");
  }
  let bestCard = null;
  let bestVal = -1;
  for (const card of hand) {
    const num = getNumber(card);
    if (num > bestVal) {
      bestCard = card;
      bestVal = num;
    }
  }
  return bestCard;
}

function getLowestCard(cardList) {
  if (cardList.length == 0) {
    console.log("ERROR: requested highest card of empty list");
  }
  let bestCard = null;
  let bestVal = 99;
  for (const card of cardList) {
    const num = getNumber(card);
    if (num < bestVal) {
      bestCard = card;
      bestVal = num;
    }
  }
  return bestCard;
}

function getTrashCard(hand) {
  // If we have any trump, try to run out of a suit if possible
  if (hand.find(x => getSuit(x) == TRUMP_SUIT) != -1){
    for (const suit of NON_TRUMP_SUITS){
      const onSuit = hand.filter(x => getSuit(x) == suit);
      if (onSuit.length == 1){
        return onSuit[0];
      }
    }
  }

  // Otherwise trash the lowest non-trump
  const nonTrump = hand.filter(x => getSuit(x) != TRUMP_SUIT);
  if (nonTrump.length > 0) {
    return getLowestCard(hand.filter(x => getSuit(x) != TRUMP_SUIT));
  } else {
    return getLowestCard(hand);
  }
}

function playOnePlayersTurn(playerIndex, turnIndex) {
  const hand = g_hands[playerIndex];
  const opponents = (playerIndex == 0 || playerIndex == 2) ? [1, 3] : [0, 2];

  // Leading
  if (turnIndex == 0) {
    // If you have any winning cards for that suit, and your opponents don't cut it, play that
    const possibleWinSuits = hand.length <= 5 ? ALL_SUITS : NON_TRUMP_SUITS;
    for (const suit of possibleWinSuits) {
      const winningCard = suit + g_highestUnplayedCard[suit];
      const oppsDontCut = !g_whoCuts[suit].includes(opponents[0]) && !g_whoCuts[suit].includes(opponents[1])
      if (oppsDontCut && hand.includes(winningCard)) {
        maybeLog("Leading with winning card..");
        return leadWithCard(winningCard);
      }
    }

    // If your teammate can cut, play into that
    for (const suit of NON_TRUMP_SUITS) {
      const teammate = (playerIndex + 2) % 4;
      if (g_whoCuts[suit].includes(teammate)) {
        const onSuit = hand.filter(x => getSuit(x) == suit);
        if (onSuit.length > 0) {
          maybeLog("Leading with a card that my teammmate can cut")
          return leadWithCard(getLowestCard(onSuit));
        }
      }
    }

    // If you have a suit that the opponents don't cut, play that
    for (const suit of NON_TRUMP_SUITS) {
      const onSuit = hand.filter(x => getSuit(x) == suit);
      const oppsDontCut = !g_whoCuts[suit].includes(opponents[0]) && !g_whoCuts[suit].includes(opponents[1])
      if (oppsDontCut && onSuit.length > 0) {
        maybeLog("Leading with a trash card that won't get cut");
        return leadWithCard(getLowestCard(onSuit));
      }
    }

    // Otherwise play a trash card
    maybeLog("Leading with trash card..");
    return leadWithCard(getTrashCard(hand));
  } else {
    // Following
    const onSuit = hand.filter(x => getSuit(x) == r_leadSuit);

    // IF HAVE SUIT
    if (onSuit.length > 0) {
      if (turnIndex == 3) {
        // If you're last and your team is winning, go low
        if (!opponents.includes(r_winningPlayer)) {
          maybeLog("Going low because already winning");
          return followWithCard(getLowestCard(onSuit), playerIndex);
        }
        // Or play the lowest needed to win, if possible
        if (!r_isCut) {
          const winningCards = onSuit.filter(x => getNumber(x) > r_highestNumPlayed);
          if (winningCards.length > 0) {
            maybeLog("Playing lowest needed to win");
            return followWithCard(getLowestCard(winningCards), playerIndex);
          }
        }
        maybeLog("Going low because cannot win");
        return followWithCard(getLowestCard(onSuit), playerIndex);
      }
      // If you have the winning card, and your opponents don't cut, play it
      if (g_highestUnplayedCard[r_leadSuit] > r_highestNumPlayed) {
        const winningCard = r_leadSuit + g_highestUnplayedCard[r_leadSuit];
        let willBeCut = r_isCut;
        for (let t = turnIndex; t < 4; t++) {
          const hypotheticalPlayerIndex = (r_leadingPlayer + t) % 4
          if (opponents.includes(hypotheticalPlayerIndex) && g_whoCuts[r_leadSuit].includes(hypotheticalPlayerIndex)) {
            willBeCut = true;
          }
        }

        const oppsDontCut = !g_whoCuts[r_leadSuit].includes(opponents[0]) && !g_whoCuts[r_leadSuit].includes(opponents[1])
        if (!r_isCut && oppsDontCut && hand.includes(winningCard)) {
          maybeLog("Playing highest unplayed card");
          return followWithCard(winningCard, playerIndex)
        }
      }
      // Otherwise go low
      maybeLog("Playing lowest on suit");
      return followWithCard(getLowestCard(onSuit), playerIndex);
    }

    // OTHERWISE, CAN PLAY ANYTHING

    // If your teammate is already winning, just trash
    if (!opponents.includes(r_winningPlayer)) {
      maybeLog("Trashing because already in the lead");
      return followWithCard(getTrashCard(hand), playerIndex);
    }
    // Otherwise play the minimum to take back the lead
    const successfulCutCards = hand.filter(x => getSuit(x) == TRUMP_SUIT && (!r_isCut || getNumber(x) > r_highestNumPlayed));
    if (successfulCutCards.length > 0) {
      maybeLog("Playing the lowest cut that takes the lead");
      return followWithCard(getLowestCard(successfulCutCards), playerIndex);
    }
    // Or play trash if unable to take back the lead
    maybeLog("Playing trash because unable to cut high enough");
    return followWithCard(getTrashCard(hand), playerIndex);
  }
}

function playRound() {
  for (let i = 0; i < 4; i++) {
    const playerIndex = (r_leadingPlayer + i) % 4;

    maybeLog("\n\n");
    maybeLog("Turn index=", i, "player to play=", playerIndex);
    maybeLog("Their hand is:", g_hands[playerIndex], "\n");

    playOnePlayersTurn(playerIndex, i);

    maybeLog("Lead suit", r_leadSuit);
    maybeLog("Highest", r_highestNumPlayed);
    maybeLog("WasCut", r_isCut);
    maybeLog("Winning player", r_winningPlayer);
    maybeLog("Highest unplayed", g_highestUnplayedCard);
    maybeLog("Who cuts", g_whoCuts);
  }
  g_score[r_winningPlayer % 2] += 1; // Award to the round winner
  r_leadingPlayer = r_winningPlayer // Set the leading player for next round
  maybeLog("Score:", g_score);
  maybeLog(r_winningPlayer, "will start next round");
  maybeLog("========================================================");
  maybeLog("========================================================");
}

function playGame() {
  setup();
  while (g_score[0] < 7 && g_score[1] < 7) {
    playRound();
  }
  maybeLog("Final score:", g_score);
}

function getStartingHandFeatures(hand) {
  function countHeld(...cards) {
    let count = 0;
    for (card of cards) {
      if (hand.includes(card)) {
        count += 1;
      }
    }
    return count;
  }

  let trumpAces = hand.includes("_14") ? 1 : 0;
  let highTrump = countHeld("_13", "_12", "_11", "_10");
  let lowTrump = hand.filter(x => getSuit(x) == TRUMP_SUIT && getNumber(x) < 10).length;
  
  let nonTrumpAces = countHeld("a14", "b14", "c14");
  // let nonTrumpKings = countHeld("a13", "b13", "c13");
  // let nonTrumpHigh = countHeld("a12", "b12", "c12", "a11", "b11", "c11", "a10", "b10", "c10");
  // let nonTrumpLow = hand.filter(x => getSuit(x) != TRUMP_SUIT && getNumber(x) < 10).length;

  let countLeastFreqSuit = 999;
  for (const suit of NON_TRUMP_SUITS){
    const onSuit = hand.filter(x => getSuit(x) == suit);
    if (onSuit.length < countLeastFreqSuit){
      countLeastFreqSuit = onSuit.length;
    }
  }

  const features = [trumpAces, highTrump, lowTrump, nonTrumpAces, countLeastFreqSuit];
  return features.join("|");
}


let team0Wins = 0;
let featureMap = new Map();
const NUM_GAMES = 1000000;
for (let i = 0; i < NUM_GAMES; i++) {
  if (i % 1000 == 0){
    console.log(i, i / NUM_GAMES);
  }

  playGame();

  // Record losses in the lookup table by hand features
  for (let i = 0; i < 4; i++){
    const featureStr = getStartingHandFeatures(g_startingHands[i]);
    if (!featureMap.has(featureStr)){
      featureMap.set(featureStr, [0, 0]);
    }
    const didWin = g_score[i % 2] == 7;
    if (didWin){
      featureMap.get(featureStr)[0] += 1;
    } else {
      featureMap.get(featureStr)[1] += 1;
    }
  }


  if (g_score[0] == 7) {
    team0Wins += 1;
  }
}
console.log("1st Team Winrate:", team0Wins / NUM_GAMES);
console.log(featureMap);