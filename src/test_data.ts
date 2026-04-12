import { classify, DICT } from '../src/utils/data';

function testClassify() {
  const tests = [
    { name: 'молоко', expected: 'Молочные продукты' },
    { name: 'адыгейский сыр', expected: 'Сыры' },
    { name: 'куриная грудка', expected: 'Мясо и птица' },
    { name: 'дорадо', expected: 'Рыба и морепродукты' },
    { name: 'подсолнечное масло', expected: 'Масла и соусы' },
    { name: 'спагетти', expected: 'Макароны и крупы' },
    { name: 'чипсы', expected: 'Снеки и орехи' },
    { name: 'кофе в зернах', expected: 'Чай и кофе' },
    { name: 'пельмени', expected: 'Заморозка' },
    { name: 'винцо', expected: 'Напитки' }, // substring match 'вино' in 'винцо'? No, 'вино' in 'винцо' might fail if strictly substring. 
    // Actually 'винцо' includes 'вино' is false, but 'вино' includes 'винцо' is false.
    // wait: norm(name).includes(k) || k.includes(norm(name))
    // 'винцо'.includes('вино') -> true. So it should work.
    { name: 'подгузники', expected: 'Детское питание' },
    { name: 'зубная паста', expected: 'Косметика и гигиена' },
    { name: 'лампочка', expected: 'Для дома' },
    { name: 'корм для собак', expected: 'Для животных' },
    { name: 'пластырь', expected: 'Аптека и здоровье' },
  ];

  console.log(`DICT size: ${Object.keys(DICT).length}`);
  
  let successCount = 0;
  tests.forEach(t => {
    const result = classify(t.name);
    if (result === t.expected) {
      console.log(`✅ ${t.name} -> ${result}`);
      successCount++;
    } else {
      console.log(`❌ ${t.name} -> ${result} (expected ${t.expected})`);
    }
  });

  console.log(`Total tests passed: ${successCount}/${tests.length}`);
}

testClassify();
