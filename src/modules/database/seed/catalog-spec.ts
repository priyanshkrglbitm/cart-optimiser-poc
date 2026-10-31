// What the sample catalog is generated from. Brands and product types are real Indian market items;
// prices, ratings and fees produced from this spec are SAMPLE DATA, not real store prices.

export type Unit = 'g' | 'ml' | 'pc';

export interface SubcategorySpec {
  category: string;
  name: string;               // product type, e.g. "Butter"
  keywords: string[];         // what users type, incl. Hinglish, e.g. ["butter", "makhan"]
  unit: Unit;
  sizes: number[];            // pack sizes in `unit`
  pricePerUnit: number;       // ₹ per g / ml / piece for a mid-priced brand at the smallest size
  brands: [string, number][]; // brand name, price multiplier vs the mid-priced brand
  variants?: [string, number][]; // variant name, price multiplier
}

export const CATALOG: SubcategorySpec[] = [
  // ── Dairy & Eggs ───────────────────────────────────────────────────────────
  { category: 'Dairy & Eggs', name: 'Milk', keywords: ['milk', 'doodh', 'dudh'], unit: 'ml', sizes: [500, 1000], pricePerUnit: 0.056,
    brands: [['Amul', 1], ['Mother Dairy', 1], ['Nandini', 0.86], ['Gowardhan', 1.04], ['Heritage', 1], ['Chitale', 1.05]],
    variants: [['Toned', 1], ['Full Cream', 1.22], ['Double Toned', 0.9], ['Cow', 1.1]] },
  { category: 'Dairy & Eggs', name: 'Curd', keywords: ['curd', 'dahi', 'yogurt'], unit: 'g', sizes: [200, 400, 1000], pricePerUnit: 0.085,
    brands: [['Amul', 1], ['Mother Dairy', 1], ['Nestle a+', 1.2], ['Milky Mist', 1.25], ['Heritage', 0.95]] },
  { category: 'Dairy & Eggs', name: 'Butter', keywords: ['butter', 'makhan'], unit: 'g', sizes: [100, 200, 500], pricePerUnit: 0.6,
    brands: [['Amul', 1], ['Mother Dairy', 0.97], ['Britannia', 1.02], ['Gowardhan', 1.05]],
    variants: [['Salted', 1], ['Unsalted', 1.04]] },
  { category: 'Dairy & Eggs', name: 'Paneer', keywords: ['paneer', 'cottage cheese'], unit: 'g', sizes: [200, 500, 1000], pricePerUnit: 0.45,
    brands: [['Amul', 1], ['Mother Dairy', 1], ['Milky Mist', 1.15], ['Gowardhan', 1.05], ['Chitale', 1.08]] },
  { category: 'Dairy & Eggs', name: 'Cheese', keywords: ['cheese'], unit: 'g', sizes: [100, 200, 400], pricePerUnit: 0.75,
    brands: [['Amul', 1], ['Britannia', 1.05], ['Go', 1.1], ['Mother Dairy', 0.98]],
    variants: [['Slices', 1], ['Block', 0.95], ['Spread', 0.85]] },
  { category: 'Dairy & Eggs', name: 'Ghee', keywords: ['ghee', 'desi ghee'], unit: 'ml', sizes: [200, 500, 1000], pricePerUnit: 0.64,
    brands: [['Amul', 1], ['Patanjali', 0.95], ['Gowardhan', 1.05], ['Nandini', 0.93], ['Aashirvaad Svasti', 1.03], ['Mother Dairy', 1]],
    variants: [['Pure', 1], ['Cow', 1.06]] },
  { category: 'Dairy & Eggs', name: 'Eggs', keywords: ['eggs', 'egg', 'anda'], unit: 'pc', sizes: [6, 12, 30], pricePerUnit: 7.5,
    brands: [['Farm Fresh', 1], ['Eggoz', 1.45], ['Kegg', 1.3], ['Henfruit', 1.35], ['Licious', 1.4]],
    variants: [['White', 1], ['Brown', 1.25]] },

  // ── Staples ────────────────────────────────────────────────────────────────
  { category: 'Atta, Rice & Dal', name: 'Atta', keywords: ['atta', 'wheat flour', 'gehu', 'chakki atta', 'flour'], unit: 'g', sizes: [1000, 5000, 10000], pricePerUnit: 0.054,
    brands: [['Aashirvaad', 1.05], ['Pillsbury', 1], ['Fortune', 0.95], ['Annapurna', 0.93], ['Patanjali', 0.9], ['Nature Fresh', 0.95]],
    variants: [['Shudh Chakki', 1], ['Multigrain', 1.3]] },
  { category: 'Atta, Rice & Dal', name: 'Basmati Rice', keywords: ['rice', 'basmati', 'basmati rice', 'chawal'], unit: 'g', sizes: [1000, 5000], pricePerUnit: 0.14,
    brands: [['India Gate', 1.1], ['Daawat', 1.05], ['Fortune', 0.9], ['Kohinoor', 1], ['Lal Qilla', 1.08]],
    variants: [['Classic', 1.25], ['Rozana', 0.8], ['Super', 1]] },
  { category: 'Atta, Rice & Dal', name: 'Sona Masoori Rice', keywords: ['rice', 'sona masoori', 'chawal'], unit: 'g', sizes: [1000, 5000, 10000], pricePerUnit: 0.065,
    brands: [['Fortune', 1], ['Daawat', 1.05], ['24 Mantra Organic', 1.3], ['Nature Fresh', 0.97]] },
  { category: 'Atta, Rice & Dal', name: 'Toor Dal', keywords: ['toor dal', 'arhar dal', 'tuvar dal', 'dal'], unit: 'g', sizes: [500, 1000], pricePerUnit: 0.18,
    brands: [['Tata Sampann', 1.1], ['Fortune', 1], ['24 Mantra Organic', 1.3], ['Rajdhani', 0.98], ['Patanjali', 0.95]],
    variants: [['Unpolished', 1], ['Regular', 0.92]] },
  { category: 'Atta, Rice & Dal', name: 'Moong Dal', keywords: ['moong dal', 'dal'], unit: 'g', sizes: [500, 1000], pricePerUnit: 0.16,
    brands: [['Tata Sampann', 1.1], ['Fortune', 1], ['24 Mantra Organic', 1.3], ['Rajdhani', 0.98]] },
  { category: 'Atta, Rice & Dal', name: 'Chana Dal', keywords: ['chana dal', 'dal'], unit: 'g', sizes: [500, 1000], pricePerUnit: 0.11,
    brands: [['Tata Sampann', 1.1], ['Fortune', 1], ['Rajdhani', 0.98], ['Patanjali', 0.95]] },
  { category: 'Atta, Rice & Dal', name: 'Masoor Dal', keywords: ['masoor dal', 'red lentil', 'dal'], unit: 'g', sizes: [500, 1000], pricePerUnit: 0.12,
    brands: [['Tata Sampann', 1.1], ['Fortune', 1], ['24 Mantra Organic', 1.3]] },
  { category: 'Atta, Rice & Dal', name: 'Rajma', keywords: ['rajma', 'kidney beans'], unit: 'g', sizes: [500, 1000], pricePerUnit: 0.17,
    brands: [['Tata Sampann', 1.1], ['Rajdhani', 1], ['24 Mantra Organic', 1.3]] },
  { category: 'Atta, Rice & Dal', name: 'Besan', keywords: ['besan', 'gram flour'], unit: 'g', sizes: [500, 1000], pricePerUnit: 0.12,
    brands: [['Rajdhani', 1], ['Fortune', 1.02], ['Tata Sampann', 1.1], ['Aashirvaad', 1.05]] },
  { category: 'Atta, Rice & Dal', name: 'Poha', keywords: ['poha', 'flattened rice', 'chivda'], unit: 'g', sizes: [500, 1000], pricePerUnit: 0.09,
    brands: [['Rajdhani', 1], ['24 Mantra Organic', 1.3], ['Fortune', 1.02], ['Tata Sampann', 1.1]],
    variants: [['Thick', 1], ['Thin', 1]] },

  // ── Oil, Sugar, Salt & Masala ──────────────────────────────────────────────
  { category: 'Oil & Masala', name: 'Sugar', keywords: ['sugar', 'cheeni', 'shakkar'], unit: 'g', sizes: [1000, 5000], pricePerUnit: 0.05,
    brands: [['Madhur', 1], ['Uttam', 0.96], ['Dhampure', 1.05], ['Trust', 0.98]],
    variants: [['Refined', 1], ['Sulphurless', 1.2]] },
  { category: 'Oil & Masala', name: 'Salt', keywords: ['salt', 'namak'], unit: 'g', sizes: [1000], pricePerUnit: 0.028,
    brands: [['Tata Salt', 1], ['Aashirvaad', 0.95], ['Catch', 1.05], ['Annapurna', 0.85]],
    variants: [['Iodised', 1], ['Rock Salt', 2.5], ['Lite', 1.7]] },
  { category: 'Oil & Masala', name: 'Sunflower Oil', keywords: ['sunflower oil', 'oil', 'refined oil', 'tel'], unit: 'ml', sizes: [1000, 5000], pricePerUnit: 0.16,
    brands: [['Fortune', 1], ['Saffola', 1.15], ['Sundrop', 1.08], ['Gemini', 0.95], ['Freedom', 0.92]] },
  { category: 'Oil & Masala', name: 'Mustard Oil', keywords: ['mustard oil', 'sarson tel', 'oil'], unit: 'ml', sizes: [1000, 5000], pricePerUnit: 0.18,
    brands: [['Fortune', 1], ['Patanjali', 0.95], ['Engine', 1.02], ['Dhara', 0.98], ['P Mark', 1]],
    variants: [['Kachi Ghani', 1]] },
  { category: 'Oil & Masala', name: 'Groundnut Oil', keywords: ['groundnut oil', 'peanut oil', 'oil'], unit: 'ml', sizes: [1000, 5000], pricePerUnit: 0.21,
    brands: [['Fortune', 1], ['Gemini', 0.97], ['Dhara', 1]] },
  { category: 'Oil & Masala', name: 'Turmeric Powder', keywords: ['turmeric', 'haldi', 'turmeric powder'], unit: 'g', sizes: [100, 200, 500], pricePerUnit: 0.3,
    brands: [['Everest', 1], ['MDH', 1.05], ['Catch', 1.02], ['Tata Sampann', 1.1], ['Aashirvaad', 1]] },
  { category: 'Oil & Masala', name: 'Red Chilli Powder', keywords: ['chilli powder', 'lal mirch', 'red chilli'], unit: 'g', sizes: [100, 200, 500], pricePerUnit: 0.35,
    brands: [['Everest', 1], ['MDH', 1.05], ['Catch', 1.02], ['Tata Sampann', 1.1]] },
  { category: 'Oil & Masala', name: 'Garam Masala', keywords: ['garam masala', 'masala'], unit: 'g', sizes: [50, 100], pricePerUnit: 0.9,
    brands: [['Everest', 1], ['MDH', 1.05], ['Catch', 1.02], ['Tata Sampann', 1.1]] },
  { category: 'Oil & Masala', name: 'Coriander Powder', keywords: ['coriander powder', 'dhaniya powder'], unit: 'g', sizes: [100, 200, 500], pricePerUnit: 0.25,
    brands: [['Everest', 1], ['MDH', 1.05], ['Catch', 1.02]] },

  // ── Breakfast & Packaged Food ──────────────────────────────────────────────
  { category: 'Breakfast & Packaged Food', name: 'Bread', keywords: ['bread'], unit: 'g', sizes: [400, 800], pricePerUnit: 0.12,
    brands: [['Britannia', 1], ['Harvest Gold', 1], ['Modern', 0.9], ['English Oven', 1.05]],
    variants: [['White', 1], ['Brown', 1.1], ['Multigrain', 1.25]] },
  { category: 'Breakfast & Packaged Food', name: 'Instant Noodles', keywords: ['noodles', 'instant noodles', 'maggi'], unit: 'g', sizes: [70, 280, 560], pricePerUnit: 0.2,
    brands: [['Maggi', 1], ['Yippee', 0.95], ['Top Ramen', 0.95], ["Ching's", 1.1]],
    variants: [['Masala', 1], ['Atta', 1.15]] },
  { category: 'Breakfast & Packaged Food', name: 'Breakfast Cereal', keywords: ['cereal', 'cornflakes', 'corn flakes', 'muesli'], unit: 'g', sizes: [250, 475, 875], pricePerUnit: 0.4,
    brands: [["Kellogg's", 1], ["Bagrry's", 0.95], ['Saffola', 0.98]],
    variants: [['Corn Flakes', 1], ['Chocos', 1.3], ['Muesli', 1.6]] },
  { category: 'Breakfast & Packaged Food', name: 'Oats', keywords: ['oats'], unit: 'g', sizes: [500, 1000], pricePerUnit: 0.28,
    brands: [['Quaker', 1], ['Saffola', 1.05], ["Kellogg's", 1], ['True Elements', 1.2]] },
  { category: 'Breakfast & Packaged Food', name: 'Jam', keywords: ['jam'], unit: 'g', sizes: [200, 500], pricePerUnit: 0.4,
    brands: [['Kissan', 1], ['Mapro', 1.15], ['Tops', 0.85]],
    variants: [['Mixed Fruit', 1], ['Strawberry', 1.05]] },
  { category: 'Breakfast & Packaged Food', name: 'Peanut Butter', keywords: ['peanut butter'], unit: 'g', sizes: [340, 1000], pricePerUnit: 0.65,
    brands: [['Pintola', 1], ['Sundrop', 0.95], ['MyFitness', 1.15], ['Alpino', 1.05]],
    variants: [['Creamy', 1], ['Crunchy', 1]] },
  { category: 'Breakfast & Packaged Food', name: 'Tomato Ketchup', keywords: ['ketchup', 'tomato ketchup', 'sauce'], unit: 'g', sizes: [500, 950], pricePerUnit: 0.25,
    brands: [['Kissan', 1], ['Maggi', 1.05], ['Heinz', 1.3], ['Tops', 0.85]] },

  // ── Snacks ─────────────────────────────────────────────────────────────────
  { category: 'Snacks & Sweets', name: 'Potato Chips', keywords: ['chips', 'wafers', 'potato chips'], unit: 'g', sizes: [50, 90, 150], pricePerUnit: 0.4,
    brands: [["Lay's", 1], ['Bingo', 0.95], ['Balaji', 0.85], ["Haldiram's", 0.95]],
    variants: [['Classic Salted', 1], ['Magic Masala', 1], ['Cream & Onion', 1]] },
  { category: 'Snacks & Sweets', name: 'Namkeen', keywords: ['namkeen', 'bhujia', 'mixture'], unit: 'g', sizes: [150, 400, 1000], pricePerUnit: 0.25,
    brands: [["Haldiram's", 1], ['Bikaji', 0.95], ['Balaji', 0.85], ['Bikano', 0.92]],
    variants: [['Aloo Bhujia', 1], ['Moong Dal', 1], ['Navratan Mix', 1.05]] },
  { category: 'Snacks & Sweets', name: 'Biscuits', keywords: ['biscuits', 'biscuit', 'cookies'], unit: 'g', sizes: [100, 250, 600], pricePerUnit: 0.12,
    brands: [['Parle', 0.8], ['Britannia', 1], ['Sunfeast', 0.95], ['Unibic', 1.3]],
    variants: [['Glucose', 0.8], ['Cream', 1.2], ['Digestive', 1.5], ['Cashew Cookies', 1.6]] },
  { category: 'Snacks & Sweets', name: 'Chocolate', keywords: ['chocolate'], unit: 'g', sizes: [40, 100, 150], pricePerUnit: 1.2,
    brands: [['Cadbury Dairy Milk', 1], ['Amul', 0.9], ['Nestle', 1]],
    variants: [['Classic', 1], ['Fruit & Nut', 1.25], ['Dark', 1.4]] },

  // ── Beverages ──────────────────────────────────────────────────────────────
  { category: 'Beverages', name: 'Tea', keywords: ['tea', 'chai', 'chai patti', 'tea powder'], unit: 'g', sizes: [250, 500, 1000], pricePerUnit: 0.55,
    brands: [['Tata Tea', 1], ['Red Label', 1.05], ['Taj Mahal', 1.3], ['Wagh Bakri', 0.98], ['Society', 1.05]],
    variants: [['Premium', 1], ['Gold', 1.15]] },
  { category: 'Beverages', name: 'Instant Coffee', keywords: ['coffee', 'instant coffee'], unit: 'g', sizes: [50, 100, 200], pricePerUnit: 3.5,
    brands: [['Nescafe', 1], ['Bru', 0.85], ['Davidoff', 1.6], ['Continental', 0.9]],
    variants: [['Classic', 1], ['Gold', 1.6]] },
  { category: 'Beverages', name: 'Soft Drink', keywords: ['cold drink', 'soft drink', 'cola', 'coke'], unit: 'ml', sizes: [750, 2250], pricePerUnit: 0.06,
    brands: [['Coca-Cola', 1], ['Pepsi', 0.98], ['Thums Up', 1], ['Sprite', 1], ['Limca', 0.98]] },
  { category: 'Beverages', name: 'Fruit Juice', keywords: ['juice', 'fruit juice'], unit: 'ml', sizes: [200, 1000], pricePerUnit: 0.12,
    brands: [['Real', 1], ['Tropicana', 1.05], ['B Natural', 0.95], ['Paper Boat', 1.2]],
    variants: [['Mixed Fruit', 1], ['Orange', 1], ['Guava', 0.95]] },
  { category: 'Beverages', name: 'Packaged Water', keywords: ['water', 'mineral water', 'water bottle'], unit: 'ml', sizes: [1000, 2000], pricePerUnit: 0.02,
    brands: [['Bisleri', 1], ['Kinley', 0.95], ['Aquafina', 0.95]] },

  // ── Personal Care ──────────────────────────────────────────────────────────
  { category: 'Personal Care', name: 'Bath Soap', keywords: ['soap', 'bathing soap', 'bath soap'], unit: 'pc', sizes: [1, 3, 4], pricePerUnit: 45,
    brands: [['Dove', 1.4], ['Lux', 0.9], ['Lifebuoy', 0.75], ['Dettol', 1], ['Santoor', 0.8], ['Pears', 1.2]] },
  { category: 'Personal Care', name: 'Shampoo', keywords: ['shampoo'], unit: 'ml', sizes: [180, 340, 650], pricePerUnit: 0.9,
    brands: [['Dove', 1.1], ['Head & Shoulders', 1.15], ['Clinic Plus', 0.7], ['Pantene', 1.05], ['Sunsilk', 0.85]] },
  { category: 'Personal Care', name: 'Toothpaste', keywords: ['toothpaste', 'paste'], unit: 'g', sizes: [100, 150, 200], pricePerUnit: 0.7,
    brands: [['Colgate', 1], ['Pepsodent', 0.85], ['Close Up', 0.95], ['Sensodyne', 2], ['Dabur Red', 0.9]] },
  { category: 'Personal Care', name: 'Handwash', keywords: ['handwash', 'hand wash'], unit: 'ml', sizes: [200, 750], pricePerUnit: 0.45,
    brands: [['Dettol', 1], ['Lifebuoy', 0.8], ['Savlon', 0.95], ['Palmolive', 1]] },

  // ── Household ──────────────────────────────────────────────────────────────
  { category: 'Household', name: 'Detergent Powder', keywords: ['detergent', 'washing powder', 'surf'], unit: 'g', sizes: [1000, 2000, 4000], pricePerUnit: 0.13,
    brands: [['Surf Excel', 1], ['Ariel', 1.1], ['Tide', 0.8], ['Rin', 0.65], ['Wheel', 0.5]] },
  { category: 'Household', name: 'Liquid Detergent', keywords: ['liquid detergent', 'detergent'], unit: 'ml', sizes: [1000, 2000], pricePerUnit: 0.22,
    brands: [['Surf Excel Matic', 1], ['Ariel Matic', 1.08], ['Tide', 0.85]] },
  { category: 'Household', name: 'Dishwash Liquid', keywords: ['dishwash', 'dish wash', 'vim'], unit: 'ml', sizes: [250, 500, 750], pricePerUnit: 0.25,
    brands: [['Vim', 1], ['Pril', 1.05], ['Exo', 0.9]] },
  { category: 'Household', name: 'Toilet Cleaner', keywords: ['toilet cleaner', 'harpic'], unit: 'ml', sizes: [500, 1000], pricePerUnit: 0.24,
    brands: [['Harpic', 1], ['Domex', 0.9], ['Lizol', 0.98]] },
  { category: 'Household', name: 'Floor Cleaner', keywords: ['floor cleaner', 'phenyl', 'lizol'], unit: 'ml', sizes: [500, 975, 2000], pricePerUnit: 0.22,
    brands: [['Lizol', 1], ['Dettol', 1.05], ['Domex', 0.9]] },

  // ── Fruits & Vegetables ────────────────────────────────────────────────────
  ...([
    ['Onion', ['onion', 'pyaz', 'kanda'], 0.04],
    ['Potato', ['potato', 'aloo', 'batata'], 0.035],
    ['Tomato', ['tomato', 'tamatar'], 0.045],
    ['Apple', ['apple', 'seb'], 0.2],
    ['Banana', ['banana', 'kela'], 0.06],
    ['Ginger', ['ginger', 'adrak'], 0.16],
    ['Garlic', ['garlic', 'lahsun'], 0.3],
    ['Green Chilli', ['green chilli', 'hari mirch', 'chilli'], 0.1],
    ['Lemon', ['lemon', 'nimbu'], 0.14],
    ['Cucumber', ['cucumber', 'kheera'], 0.05],
  ] as [string, string[], number][]).map(([name, keywords, pricePerUnit]): SubcategorySpec => ({
    category: 'Fruits & Vegetables', name, keywords, unit: 'g', sizes: [250, 500, 1000], pricePerUnit,
    brands: [['Fresh', 1], ['Organic', 1.6]],
  })),
];
