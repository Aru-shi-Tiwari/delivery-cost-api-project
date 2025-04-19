const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Graph structure with distances
const graph = {
    "C1": { "C2": 4.0, "L1": 3.0 },
    "C2": { "C1": 4.0, "L1": 2.5, "C3": 3.0 },
    "C3": { "C2": 3.0, "L1": 2.0 },
    "L1": { "C1": 3.0, "C2": 2.5, "C3": 2.0 }
};

// Product to center mappings with weights
const centerToProductMappings = {
    "C1": { "A": 3.0, "B": 2.0, "C": 8.0 },
    "C2": { "D": 12.0, "E": 25.0, "F": 15.0 },
    "C3": { "G": 0.5, "H": 1.0, "I": 2.0 }
};

// Product to center lookup
const productToCentreMapping = {
    "A": "C1", "B": "C1", "C": "C1",
    "D": "C2", "E": "C2", "F": "C2",
    "G": "C3", "H": "C3", "I": "C3"
};

function calculateCost(distance, weight) {
    if (weight <= 5.0) return distance * 10.0;
    weight -= 5.0;
    return 10.0 * distance + Math.ceil(weight / 5.0) * 8.0 * distance;
}

function dfs(current, pickups, currentWeight, currentCost, visitedCenters, minCost, depth = 0) {
    // Prevent infinite recursion
    if (depth > 15) return;

    // If current is a pickup center, pick its weight
    if (pickups[current] !== undefined) {
        currentWeight += pickups[current];
        delete pickups[current];
        visitedCenters.add(current);
    }

    // If at L1, drop all weight
    if (current === "L1") {
        currentWeight = 0.0;
        if (Object.keys(pickups).length === 0) {
            minCost.value = Math.min(minCost.value, currentCost);
            return;
        }
    }

    // Explore all neighbors
    for (const [neighbor, distance] of Object.entries(graph[current])) {
        const edgeCost = calculateCost(distance, currentWeight);
        dfs(neighbor, {...pickups}, currentWeight, currentCost + edgeCost, new Set(visitedCenters), minCost, depth + 1);
    }
}

app.post('/calculate-delivery-cost', (req, res) => {
    try {
        const order = req.body;
        
        // Validate input
        if (!order || typeof order !== 'object') {
            return res.status(400).json({ error: "Invalid order format" });
        }

        const centerToWeightMapping = {};
        const pickupCenters = new Set();

        // Process the order
        for (const [product, quantity] of Object.entries(order)) {
            if (!productToCentreMapping[product]) {
                return res.status(400).json({ error: `Invalid product: ${product}` });
            }
            if (!Number.isInteger(quantity) || quantity < 0) {
                return res.status(400).json({ error: `Invalid quantity for ${product}` });
            }

            const center = productToCentreMapping[product];
            const weight = centerToProductMappings[center][product] * quantity;
            centerToWeightMapping[center] = (centerToWeightMapping[center] || 0) + weight;
            pickupCenters.add(center);
        }

        const minCost = { value: Infinity };
        const pickupCentersArray = Array.from(pickupCenters);

        // Try starting from each pickup center
        for (const start of pickupCentersArray) {
            dfs(start, {...centerToWeightMapping}, 0.0, 0.0, new Set(), minCost);
        }

        if (minCost.value === Infinity) {
            return res.json({ cost: 0 });
        }

        res.json({ cost: minCost.value });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: "Internal server error" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});