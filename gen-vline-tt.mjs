import { MongoDatabaseConnection } from '@transportme/database'
import config from './config.json' with { type: 'json' }
import utils from './utils.js'

const allDates = utils.allDaysBetweenDates(
  utils.parseDate('20250906'),
  utils.parseDate('20250914')
).map(date => utils.getYYYYMMDD(date))

let dates = {
  '20250816': [
`CAROLINE SPRINGS	dep	05.20	05.54	06.16	06.29	06.41	06.55
Deer Park		05.23	05.57	–	06.32	-	06.58
Ardeer		05.26	06.00	–	06.35	06.45	–
Sunshine		05.32	06.06	06.24	06.40	06.49	07.05
Footscray		05.38	06.12	06.30	06.46	06.55	07.11
SOUTHERN CROSS	arr	05.48	06.22	06.40	06.56	07.05	07.21`,
`CAROLINE SPRINGS 	dep	07.10	07.16	06.55	07.32	07.10		07.54	07.16		07.32		08.05
Deer Park		–	07.19	06.58	07.37	–		–	07.19		07.37		08.09
Ardeer		07.16	–	–	–	07.16		07.58	–		–		–
Sunshine		07.21	07.27	07.05	07.43	07.21		08.05	07.27		07.43		08.16
Footscray		07.27	07.33	07.11	07.49	07.27		08.11	07.33		07.49		08.22
SOUTHERN CROSS 	arr	07.37	07.44	07.21	07.59	07.37		08.21	07.44		07.59		08.31`,
`CAROLINE SPRINGS 	dep	08.21	08.42	08.21	08.42		09.15	08.42	08.53	09.30
Deer Park		–	08.45	–	08.45		09.20	08.45	08.57	09.33
Ardeer		08.25	–	08.25	–		09.23	–	09.00	09.36
Sunshine		08.30	08.50	08.30	08.50		09.27	08.50	09.05	09.39
Footscray		08.36	08.56	08.36	08.56		09.33	08.56	09.11	09.45
SOUTHERN CROSS 	arr	08.46	09.06	08.46	09.06		09.43	09.06	09.21	09.55`,
`CAROLINE SPRINGS 	dep	07.54	08.05
Deer Park		07.58	08.09 
Ardeer		-	-
Sunshine		08.05	08.16
Footscray		08.11	08.22
SOUTHERN CROSS 	arr	08.21	08.31`,
`CAROLINE SPRINGS	dep	09.15	09.30	10.05	09.45	09.30
Deer Park		09.20	09.33	10.09	09.49	09.33
Ardeer		09.23	09.36	10.12	09.52	09.36
Sunshine		09.27	09.39	10.17	09.57	09.39
Footscray		09.33	09.45	10.23	10.03	09.45
SOUTHERN CROSS	arr	09.43	09.55	10.33	10.13	09.55`,
`CAROLINE SPRINGS	dep	12.06	11.46	12.26	12.06	12.46	12.26	13.06	12.46	13.26	13.06	13.46	14.07
Deer Park		12.09	11.48	12.28	12.09	12.49	12.28	13.09	12.49	13.29	13.09	13.49	14.10
Ardeer		12.11	11.51	12.31	12.11	12.51	12.31	13.11	12.51	13.31	13.11	13.51	14.12
Sunshine		12.15	11.55	12.35	12.15	12.55	12.35	13.15	12.55	13.35	13.15	13.55	14.16
Footscray		12.21	12.01	12.41	12.21	13.01	12.41	13.21	13.01	13.41	13.21	14.01	14.22
SOUTHERN CROSS	arr	12.31	12.11	12.51	12.31	13.11	12.51	13.31	13.11	13.51	13.31	14.11	14.32`,
`CAROLINE SPRINGS	dep	13.46	14.26	14.46	14.26	15.04	14.46	15.04	15.44	15.26	16.06	15.44	16.24
Deer Park		13.49	14.29	14.48	14.29	15.07	14.48	15.07	15.47	15.29	16.09	15.47	16.27
Ardeer		13.51	14.31	14.51	14.31	15.11	14.51	15.11	15.50	15.31	16.11	15.50	16.30
Sunshine		13.55	14.35	14.55	14.35	15.15	14.55	15.15	15.55	15.35	16.15	15.55	16.35
Footscray		14.01	14.41	15.01	14.41	15.21	15.01	15.21	16.01	15.41	16.21	16.01	16.41
SOUTHERN CROSS	arr	14.11	14.51	15.11	14.51	15.31	15.11	15.31	16.11	15.51	16.31	16.11	16.51`,
`CAROLINE SPRINGS	dep	18.00	18.42	19.20	19.56	20.36	21.16	21.56
Deer Park		18.04	18.45	19.23	19.59	20.40	21.19	21.59
Ardeer		18.07	18.48	19.26	20.02	20.43	21.22	22.02
Sunshine		18.12	18.53	19.31	20.07	20.47	21.27	22.07
Footscray		18.18	18.59	19.37	20.13	20.53	21.33	22.13
SOUTHERN CROSS	arr	18.28	19.09	19.47	20.23	21.03	21.43	22.23`,
`CAROLINE SPRINGS	dep	16.58
Deer Park		-
Ardeer		-
Sunshine		17.07
Footscray		17.13
SOUTHERN CROSS	arr	17.23`,
`SOUTHERN CROSS	dep	17.18	17.21	17.38
Footscray		17.26	17.29	17.46
Sunshine		17.31	17.34	17.51
Ardeer		–	17.38	–
Deer Park		17.36	–	17.56
CAROLINE SPRINGS	arr	17.41	17.45	18.03`,
`SOUTHERN CROSS	dep	17.38	17.58	18.05	18.18		18.25
Footscray		17.46	18.06	18.13	18.26		18.33
Sunshine		17.51	18.11	18.18	18.31		18.38
Ardeer		–	–	18.22	–		18.42
Deer Park		17.56	18.16	–	18.36		–
CAROLINE SPRINGS	arr	18.03	18.21	18.29	18.40		18.48`,
`SOUTHERN CROSS	dep	18.48	19.28		20.08		20.48
Footscray		18.56	19.36		20.16		20.56
Sunshine		19.01	19.41		20.21		21.01
Ardeer		19.05	19.45		20.25		21.05
Deer Park		19.08	19.48		20.28		21.08
CAROLINE SPRINGS	arr	19.12	19.52		20.32		21.11`,
`BACCHUS MARSH	dep	08.15	08.55		09.35			10.15		10.55
Ballan		08.34	09.14		09.54			10.34		11.14
Ballarat		08.56	09.36		10.16		10.22	10.56		11.36
Wendouree		09.06	09.49		–		10.29	11.06		11.46
Beaufort			10.11		–															
Ararat			10.39		–					
Creswick					10.34					
Clunes					10.47					
Talbot					11.00					
MARYBOROUGH	arr				11.15					`,
    `BACCHUS MARSH 	dep	11.35	12.15			12.55		13.35	14.15
Ballan		11.54	12.34			13.14		13.54	14.34
Ballarat		12.16	12.56			13.36		14.16	14.56
Wendouree		12.29	13.06			13.46		14.26	15.09
Beaufort		12.51							15.31
ARARAT 	arr	13.19							15.59`,
`BACCHUS MARSH 	dep	14.15	14.55	15.35			16.15		
Ballan		14.34	15.14	15.54			16.34		
Ballarat		14.56	15.36	16.16			16.56		
Wendouree		15.09	15.46	16.26			17.06		
Beaufort		15.31							
ARARAT 	arr	15.59							`,
`BACCHUS MARSH 	dep	16.55		17.35				18.15		18.55
Ballan		17.14		17.54				18.34		19.14
Ballarat		17.36		18.16				18.56		19.36
WENDOUREE 	arr	17.46		18.26				19.06		19.46`, 
`BACCHUS MARSH	dep		18.55		19.35		19.35			20.15	
Ballan			19.14		19.54		19.54			20.34	
Ballarat			19.36		20.16		20.16		20.22	20.58	
Wendouree			19.46		20.29		20.29		–	21.08	
Beaufort					20.51		20.51		–		
Ararat					21.19		21.19		–		
Creswick									20.37		
											
Clunes									20.50		
Talbot									21.03		
MARYBOROUGH	arr								21.16		`,
`BACCHUS MARSH 	dep	20.15	20.55		20.55			21.35
Ballan		20.34	21.14		21.14			21.54
Ballarat		20.58	21.36		21.36			22.16
WENDOUREE 	arr	21.08	21.46		21.46			22.26`,
`BACCHUS MARSH 	dep	22.15	23.17	22.16	23.17		00.05			00.05
Ballan		22.34	23.35	22.39b	23.35		00.22			00.22
Ballarat		22.56	23.55	23.13b	23.55		00.42			00.42
Wendouree		23.06	00.04	23.26	00.04		00.51			00.51
Beaufort		23.29								
ARARAT 	arr	23.57								`,
`BACCHUS MARSH		01.05
Ballan		01.22
Ballarat		01.42
WENDOUREE		01.51`,
`BACCHUS MARSH	dep	08.15	08.55	09.35		10.15	10.55
Ballan		08.34	09.14	09.54		10.34	11.14
Ballarat		08.56	09.36	10.16	10.27	10.56	11.36
Wendouree		09.06	09.49	–	10.34	11.06	11.46
Beaufort			10.11	–										
Ararat			10.39	–			
Creswick				10.34			
Clunes				10.47			
Talbot				11.00			
MARYBOROUGH	arr			11.15			`,
`BACCHUS MARSH	dep	11.35	12.15	12.55	13.35
Ballan		11.54	12.34	13.14	13.54
Ballarat		12.16	12.56	13.36	14.16
Wendouree		12.29	13.06	13.46	14.26
Beaufort		12.51								
ARARAT	arr	13.19			`,
`BACCHUS MARSH 	dep	14.15	14.55			15.35			16.15
Ballan		14.34	15.14			15.54			16.34
Ballarat		14.56	15.36			16.16			16.56
Wendouree		15.09	15.46			16.26			17.06
Beaufort		15.31							
ARARAT 	arr	15.59							`,
`BACCHUS MARSH 	dep	16.15		16.55		17.35			18.15
Ballan		16.34		17.14		17.54			18.34
Ballarat		16.56		17.36		18.16			18.56
WENDOUREE 	arr	17.06		17.46		18.26			19.06`,
`BACCHUS MARSH	dep	18.15	18.55	18.55	19.35	19.35
Ballan		18.34	19.14	19.14	19.54	19.54
Ballarat		18.56	19.36	19.36	20.16	20.16
Wendouree		19.06	19.46	19.46	20.29	20.29
Beaufort					20.51	20.51						
ARARAT	arr				21.19	21.19						`,
`BACCHUS MARSH	dep		20.15	20.15	20.55	20.55
Ballan			20.34	20.34	21.14	21.14
Ballarat		20.22	20.58	20.58	21.36	21.36
Wendouree		–	21.08	21.08	21.46	21.46
Creswick		20.37										
Clunes		20.50				
Talbot		21.03				
MARYBOROUGH	arr	21.16				`,
`BACCHUS MARSH 	dep	21.35	22.20		23.02	00.04		00.50b
Ballan		21.54	22.39		23.20	00.22		01.13b
Ballarat		22.16	23.04		23.40	00.42		01.47b
Wendouree		22.26	23.11		23.49	00.51		02.00b
Beaufort			23.34					02.40
ARARAT 	arr		00.02					`,
`BACCHUS MARSH	dep		20.15	20.15
Ballan			20.34	20.34
Ballarat		20.22	20.58	20.58
Wendouree		–	21.08	21.08
Creswick		20.37						
Clunes		20.50		
Talbot		21.03		
MARYBOROUGH	arr	21.16		`,
`BACCHUS MARSH	dep	06.13	06.51		07.31			08.11			08.53
Ballan		06.31	07.13		07.53			08.35			09.12
Ballarat		06.57	07.38		08.23			08.57			09.36
Wendouree		07.06	07.48		08.32			09.07			09.46
Beaufort											10.09											
ARARAT	arr										10.37`,
`BACCHUS MARSH	dep	09.39				10.16				10.56		11.36
Ballan		09.57				10.35				11.15		11.55
Ballarat		10.18				10.56		11.02		11.36		12.16
Wendouree		10.27				11.06		–		11.46		12.26
Beaufort								–																
Ararat								–				
Creswick								11.17				
Clunes								11.30				
Talbot								11.43				
MARYBOROUGH	arr							11.58				`,
`BACCHUS MARSH	dep	11.36		12.16				12.56			13.36
Ballan		11.55		12.35				13.15			13.55
Ballarat		12.16		12.56				13.36			14.16
Wendouree		12.26		13.06				13.46			14.26
Beaufort				13.29																		
ARARAT	arr			13.57							`,
`BACCHUS MARSH	dep			14.16					14.56				15.36
Ballan				14.35					15.15				15.55
Ballarat				14.56					15.36				16.16
Wendouree				15.06					15.46				16.26
Beaufort													16.49													
ARARAT	arr												17.17`,
`BACCHUS MARSH	dep	15.36		16.51		16.16
Ballan		15.55		17.09		16.35
Ballarat		16.16		17.29		16.56
Wendouree		16.26		17.38		17.06
Beaufort		16.49				
ARARAT	arr	17.17				`,
`BACCHUS MARSH	dep	16.51		17.32					17.10	17.32	
Ballan		17.09		17.50					17.28	17.50	
Ballarat		17.29		18.10	18.16				17.48	18.10	18.16
Wendouree		17.38		18.20	–				17.57	18.20	–
Beaufort					–						–
											
Ararat					–						–
Creswick					18.31						18.31
Clunes					18.44						18.44
Talbot					18.57						18.57
MARYBOROUGH	arr				19.12						19.12`,
`BACCHUS MARSH	dep	18.11				17.51			18.11	18.31		18.11
Ballan		18.29				18.09			18.29	18.49		18.29
Ballarat		18.51				18.29			18.51	19.09		18.51
Wendouree		19.00				18.39			19.00	19.18		19.00
Beaufort						19.02						
												
ARARAT	arr					19.30						`,
`BACCHUS MARSH	dep	18.11	18.51			18.31		19.11
Ballan		18.29	19.09			18.49		19.29
Ballarat		18.51	19.30			19.09		19.49
Wendouree		19.00	19.40			19.18		19.59
Beaufort								20.22
								
ARARAT	arr							20.50`,
`BACCHUS MARSH	dep	18.31	18.51	18.51		18.51	19.11	18.51		19.48	
Ballan		18.49	19.09	19.09		19.09	19.29	19.09		20.06	
Ballarat		19.09	19.30	19.30		19.30	19.49	19.30		20.26	
Wendouree		19.18	19.40	19.40		19.40	19.59	19.40		20.36	
Beaufort							20.22				
											
ARARAT	arr						20.50				`,
`BACCHUS MARSH	dep	19.11	19.48				19.48		20.28
Ballan		19.29	20.06				20.06		20.46
Ballarat		19.49	20.26				20.26		21.06
Wendouree		19.59	20.36				20.36		21.16
Beaufort		20.22							
									
ARARAT	arr	20.50							`,
`BACCHUS MARSH	dep			20.28			21.08				21.48		22.28
Ballan				20.46			21.26				22.06		22.46
Ballarat				21.06			21.46				22.26		23.06
WENDOUREE	arr			21.16			21.56				22.36		23.16`,
`BACCHUS MARSH	dep	22.28	23.08		23.53		00.37
Ballan		22.46	23.26		00.11		00.55
Ballarat		23.06	23.46		00.31		01.15
WENDOUREE	arr	23.16	23.56		00.41		01.25`,
`ARARAT	dep									07.14
Beaufort										07.39
Wendouree		04.43		05.58		06.53		07.33		08.03
Ballarat		04.56		06.02		06.57		07.37		08.07
Ballan		05.30		06.22		07.17		07.57		08.37
BACCHUS MARSH	arr	05.53		06.40		07.35		08.15		08.55`,
`MARYBOROUGH	dep			07.51						
Talbot				08.01						
Clunes				08.14						
Creswick				08.27						
Ararat		07.14		–		08.33				
Beaufort		07.39		–		08.58				
Wendouree		08.03		–		09.33		10.13		10.53
Ballarat		08.07		08.22		09.37		10.17		10.57
Ballan		08.37		09.16		09.57		10.37		11.17
BACCHUS MARSH	arr	08.55		09.34		10.15		10.55		11.35`,
`ARARAT	dep					11.12				
Beaufort						11.38				
Wendouree		10.53		11.33		12.03		12.53		13.33
Ballarat		10.57		11.37		12.07		12.57		13.37
Ballan		11.17		11.58		12.37		13.18		13.57
BACCHUS MARSH	arr	11.35		12.16		12.55		13.36		14.15`,
`ARARAT	dep					13.52			
Beaufort						14.18			
Wendouree		13.33		14.13		14.43	15.33		16.13
Ballarat		13.37		14.17		14.47	15.37		16.17
Ballan		13.57		14.37		15.17	15.57		16.37
BACCHUS MARSH	arr	14.15		14.55		15.35	16.15		16.55`,
`MARYBOROUGH	dep	15.58					
Talbot		16.08					
Clunes		16.21					
Creswick		16.34					
Ararat				16.32			
Beaufort				16.58			
Wendouree			16.53	17.23	18.13	19.32	18.52
Ballarat		16.53	16.57	17.27	18.17	19.36	18.56
Ballan			17.17	17.57	18.37	19.57	19.17
BACCHUS MARSH	arr		17.35	18.15	18.55	20.15	19.35`,
`ARARAT	dep									07.14
Beaufort										07.39
Wendouree		04.40		05.58		06.53		07.33		08.03
Ballarat		04.53		06.02		06.57		07.37		08.07
Ballan		05.27		06.22		07.17		07.57		08.37
BACCHUS MARSH	arr	05.50		06.40		07.35		08.15		08.55`,
`MARYBOROUGH	dep			07.51						
Talbot				08.01						
Clunes				08.14						
Creswick				08.27						
Ararat		07.14		–		08.33				
Beaufort		07.39		–		08.58				
Wendouree		08.03		–		09.33		10.13		10.53
Ballarat		08.07		08.46		09.37		10.17		10.57
Ballan		08.37		09.16		09.57		10.37		11.17
BACCHUS MARSH	arr	08.55		09.34		10.15		10.54		11.35`,
`ARARAT	dep					11.12			
Beaufort						11.38			
Wendouree		10.53		11.33		12.03		12.53	13.33
Ballarat		10.57		11.37		12.07		12.57	13.37
Ballan		11.17		11.57		12.37		13.18	13.57
BACCHUS MARSH	arr	11.35		12.15		12.55		13.36	14.15`,
`MARYBOROUGH	dep							
Talbot								
Clunes								
Creswick								
Ararat			13.52					16.32
Beaufort			14.18					16.58
Wendouree		14.13	14.43	15.33	16.13		16.53	17.23
Ballarat		14.17	14.47	15.37	16.17		16.57	17.27
Ballan		14.37	15.17	15.57	16.37		17.17	17.57
BACCHUS MARSH	arr	14.55	15.35	16.15	16.55		17.35	18.15`,
`ARARAT	dep	16.32							
Beaufort		16.58							
Wendouree		17.23	18.13		18.52		19.32	20.27	21.32
Ballarat		17.27	18.17		18.56		19.36	20.31	21.36
Ballan		17.57	18.37		19.17		19.57	20.54	21.57
BACCHUS MARSH	arr	18.15	18.55		19.35		20.15	21.17	22.15`,
`ARARAT	dep	16.32			
Beaufort		16.58			
Wendouree		17.23	18.13		18.52
Ballarat		17.27	18.17		18.56
Ballan		17.57	18.37		19.17
BACCHUS MARSH	arr	18.15	18.55		19.35`,
`BALLARAT	dep	03.13		04.23	04.23
Ballan		03.47		04.41	04.41
BACCHUS MARSH	arr	04.10		04.58	04.58`,
`Wendouree		05.33
Ballarat		05.37
Ballan		05.57
BACCHUS MARSH	arr	06.14`,
`ARARAT	dep		06.28	
Beaufort			06.54	
Wendouree		07.10	07.33	07.54
Ballarat		07.14	07.37	07.58
Ballan		07.35	07.57	08.18
BACCHUS MARSH	arr	07.54	08.15	08.35`,
`WENDOUREE 	dep	06.29	06.11	06.52						07.10
Ballarat		06.33	06.15	06.56						07.14
Ballan		06.53	06.35	07.17						07.35
BACCHUS MARSH 	arr	07.12	06.54	07.34						07.54`,
`ARARAT	dep		06.28	
Beaufort			06.54	
Wendouree		07.10	07.33	07.54
Ballarat		07.14	07.37	07.58
Ballan		07.35	07.57	08.18
BACCHUS MARSH	arr	07.54	08.15	08.35`,
`ARARAT	dep		07.26
Beaufort			07.72
Wendouree		07.10	08.16
Ballarat		07.14	08.22`,
`MARYBOROUGH	dep	07.22						
Talbot		07.32						
Clunes		07.45						
Creswick		07.58						
Wendouree		–			08.53			09.33
Ballarat		08.17			08.57			09.37
Ballan		08.53			09.17			09.57
BACCHUS MARSH	arr	09.13			09.35			10.15`,
`WENDOUREE 	dep		10.13			10.53			11.33
Ballarat			10.17			10.57			11.37
Ballan			10.37			11.17			11.57
BACCHUS MARSH 	arr		10.55			11.35			12.15`,
`ARARAT 	dep			12.03					
Beaufort				12.29					
Wendouree		12.13		12.53	13.33				14.13
Ballarat		12.17		12.57	13.37				14.17
Ballan		12.37		13.17	13.57				14.37
BACCHUS MARSH 	arr	12.55		13.35	14.15				14.55`,
`ARARAT 	dep				17.32						
Beaufort					17.58						
Wendouree			16.55	17.41	18.22		19.02		19.43		20.22
Ballarat			16.59	17.45	18.26		19.06		19.47		20.26
Ballan			17.27	18.09	18.50		19.30		20.09		20.48
BACCHUS MARSH 	arr		17.54	18.32	19.13		19.47		20.27		21.06`,
`WENDOUREE 	dep	20.22	21.02	21.42	22.22		23.02	23.42
Ballarat		20.26	21.06	21.46	22.26		23.06	23.46
Ballan		20.48	21.28	22.08	22.48		23.28	00.09
BACCHUS MARSH 	arr	21.06	21.46	22.26	23.06		23.46	00.28`,
`ARARAT	dep			14.43
Beaufort				15.09
Wendouree		14.53	15.59	15.33
Ballarat		14.57	16.19	15.37
Ballan		15.17	16.38	15.57
BACCHUS MARSH	arr	15.35	16.56	16.15`,
`Maryborough	dep	15.12
Talbot		15.22
Clunes		15.35
Creswick		15.48
Ballarat		16.07`
].map(z => z.replace(/\n\n+/g, '\n').trim())
}

let mongoDB = new MongoDatabaseConnection(config.databaseURL, config.databaseName)
await mongoDB.connect()

let vlineStops = (await mongoDB.getCollection('stops').findDocuments({
  'bays.mode': 'regional train'
}).toArray()).reduce((acc, e) => ({
  ...acc,
  [e.stopName.slice(0, -16)]: e.bays.find(b => b.mode === 'regional train' && b.stopType === 'station')
}), {})

const vlineRoutes = await mongoDB.getCollection('routes').findDocuments({
  mode: 'regional train'
}).toArray()

vlineRoutes[1].directions[0].stops.splice(-3, 0, {
  stopName: 'Ballarat Railway Station',
  stopNumber: null,
  suburb: 'Ballarat Central',
  stopGTFSID: 'vic:rail:BAT-V'
})

vlineRoutes[1].directions[1].stops.splice(3, 0, {
  stopName: 'Ballarat Railway Station',
  stopNumber: null,
  suburb: 'Ballarat Central',
  stopGTFSID: 'vic:rail:BAT-V'
})

const trips = Object.keys(dates).map(targetDate => [targetDate, dates[targetDate]]).flatMap(([targetDate, texts]) => texts.flatMap(text => {
  const table = text.split('\n').map(line => line.split('\t'))

  const stations = table.map(row => utils.titleCase(row[0]).replace('Station', '').trim())
  const runs = Array(table[0].length).fill(0).map((e, i) => i).slice(2).map(index => {
    return table.map(row => row[index] || '')
  })
  return runs.map(runTimes => runTimes.map((time, i) => ({
    station: stations[i],
    time,
    stnTime: time.slice(0, 5).replace('.', ':'),
    timeMin: utils.getMinutesPastMidnightFromHHMM(time.slice(0, 5).replace('.', ':'))
  })).filter(stn => stn.time.length > 1).filter(station => vlineStops[station.station]).map(station => ({
      "stopName" : vlineStops[station.station].fullStopName,
      "stopNumber" : null,
      "suburb" : vlineStops[station.station].suburb,
      "stopGTFSID" : vlineStops[station.station].stopGTFSID,
      "arrivalTime" : station.stnTime,
      "arrivalTimeMinutes" : station.timeMin,
      "departureTime" : station.stnTime,
      "departureTimeMinutes" : station.timeMin,
      "stopConditions" : {
        "pickup" : station.time.length === 5 ? 0 : station.time[station.time.length - 1] === 'd' ? 1 : 0,
        "dropoff" : station.time.length === 5 ? 0 : station.time[station.time.length - 1] === 'u' ? 1 : 0
      }
  })).map((station, i, arr) => {
    if (i === 0) return station
    if (i === arr.length - 1) return station
    if (station.stopName === arr[i + 1].stopName) return {
      ...station,
      departureTime: arr[i + 1].departureTime,
      departureTimeMinutes: arr[i + 1].departureTimeMinutes
    }
    if (station.stopName === arr[i - 1].stopName) return null
    return station
  }).filter(Boolean).map((station, i) => {
    if (i === 0 && station.departureTimeMinutes < 180) return {
      ...station,
      departureTimeMinutes: station.departureTimeMinutes + 1440,
      arrivalTimeMinutes: station.arrivalTimeMinutes + 1440
    }
    return station
  }).map((station, i, arr) => {
    if (i === 0) return station
    if (station.arrivalTimeMinutes < arr[i - 1].departureTimeMinutes) return {
      ...station,
      departureTimeMinutes: station.departureTimeMinutes + 1440,
      arrivalTimeMinutes: station.arrivalTimeMinutes + 1440
    }

    return station
  })).filter(stopTimings => stopTimings.length).map(stopTimings => ({
    stopTimings,
    route: vlineRoutes.find(route => route.directions[0].stops.some(s=>s.stopName === stopTimings[0].stopName) && route.directions[0].stops.some(s=>s.stopName === stopTimings[stopTimings.length - 1].stopName))
  })).map(({stopTimings, route}) => ({
    "mode" : "regional train",
    "routeName" : route?.routeName,
    "routeNumber" : null,
    "routeGTFSID" : route.routeGTFSID,
    "operationDays" : [
      ...allDates
      // targetDate
    ],
    "tripID" : `${route.routeGTFSID}-${stopTimings[0].stopGTFSID.slice(9, 13)}-${stopTimings[0].departureTimeMinutes}`,
    "shapeID" : null,
    "block" : null,
    "gtfsDirection" : route.directions.find(dir => dir.stops.findIndex(s=>s.stopName === stopTimings[0].stopName) < dir.stops.findIndex(s=>s.stopName === stopTimings[stopTimings.length - 1].stopName)).gtfsDirection,
    "isRailReplacementBus" : false,
    "direction" : route.directions.find(dir => dir.stops.findIndex(s=>s.stopName === stopTimings[0].stopName) < dir.stops.findIndex(s=>s.stopName === stopTimings[stopTimings.length - 1].stopName)).directionName === 'Southern Cross Railway Station' ? 'Up' : 'Down',
    stopTimings,
    origin: stopTimings[0].stopName,
    destination: stopTimings[stopTimings.length - 1].stopName,
    departureTime: stopTimings[0].departureTime,
    destinationArrivalTime: stopTimings[stopTimings.length - 1].arrivalTime
  }))
}))

await mongoDB.getCollection('gtfs timetables').bulkWrite(trips.map(trip => ({
  replaceOne: {
    filter: { mode: trip.mode, operationDays: trip.operationDays[0], tripID: trip.tripID },
    replacement: trip,
    upsert: true
  }
})))
// console.log(trips)
process.exit(0)