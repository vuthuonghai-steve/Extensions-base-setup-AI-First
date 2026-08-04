/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'arc-1: contracts-khong-ngo',
      from: { path: '^src/0_contracts' },
      to: { path: '^src/(1_engine|2_platform_adapters|3_modules|4_presentation)' },
    },
    {
      name: 'arc-1: platform-khong-ngo',
      from: { path: '^src/2_platform_adapters' },
      to: { path: '^src/(1_engine|3_modules|4_presentation)' },
    },
    {
      name: 'arc-1: modules-khong-ngo',
      from: { path: '^src/3_modules' },
      to: { path: '^src/(1_engine|2_platform_adapters|4_presentation)' },
    },
    {
      name: 'arc-1: engine-khong-ngo',
      from: { path: '^src/1_engine' },
      to: { path: '^src/(3_modules|4_presentation)' },
    },
  ],
};
