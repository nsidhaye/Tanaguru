/*
 * Tanaguru - Automated webpage assessment
 * Copyright (C) 2008-2015 Tanaguru.org
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * Contact us by mail: tanaguru AT tanaguru DOT org
 */

package org.tanaguru.rules.accessiweb22;

import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.tanaguru.entity.audit.TestSolution;
import org.tanaguru.processor.SSPHandler;
import org.tanaguru.ruleimplementation.AbstractMarkerPageRuleImplementation;
import org.tanaguru.rules.elementchecker.pertinence.TextPertinenceChecker;
import org.tanaguru.rules.elementselector.SimpleElementSelector;
import static org.tanaguru.rules.keystore.CssLikeQueryStore.TABLE_WITH_CAPTION_CSS_LIKE_QUERY;
import static org.tanaguru.rules.keystore.HtmlElementStore.CAPTION_ELEMENT;
import static org.tanaguru.rules.keystore.HtmlElementStore.TEXT_ELEMENT2;
import static org.tanaguru.rules.keystore.MarkerStore.DATA_TABLE_MARKER;
import static org.tanaguru.rules.keystore.MarkerStore.PRESENTATION_TABLE_MARKER;
import static org.tanaguru.rules.keystore.RemarkMessageStore.*;

/**
 * Implementation of the rule 5.5.1 of the referential Accessiweb 2.2.
 * <br>
 * For more details about the implementation, refer to <a href="http://www.tanaguru.org/en/content/aw22-rule-5-5-1">the rule 5.5.1 design page.</a>
 * @see <a href="http://www.accessiweb.org/index.php/accessiweb-22-english-version.html#test-5-5-1"> 5.5.1 rule specification</a>
 *
 */
public class Aw22Rule05051 extends AbstractMarkerPageRuleImplementation {

    /**
     * Default constructor
     */
    public Aw22Rule05051() {
        super(
                new SimpleElementSelector(TABLE_WITH_CAPTION_CSS_LIKE_QUERY),

                // the data tables are part of the scope
                DATA_TABLE_MARKER,

                // the presentation tables are not part of the scope
                PRESENTATION_TABLE_MARKER,

                // checker for elements identified by marker
                new TextPertinenceChecker(
                    // check emptiness
                    true, 
                    // no comparison with other attribute
                    null,
                    // no comparison with blacklist
                    null,
                    // not pertinent message
                    NOT_PERTINENT_CAPTION_MSG, 
                    // manual check message
                    CHECK_CAPTION_PERTINENCE_FOR_DATA_TABLE_MSG, 
                    // evidence element
                    TEXT_ELEMENT2),
                
                // checker for elements not identified by marker
                new TextPertinenceChecker(
                   // check emptiness
                    true, 
                    // no comparison with other attribute
                    null,
                    // no comparison with blacklist
                    null,
                    // override not pertinent result
                    TestSolution.NEED_MORE_INFO, 
                    // not pertinent message
                    CHECK_NATURE_OF_TABLE_FOR_NOT_PERTINENT_CAPTION_MSG, 
                    // manual check message
                    CHECK_NATURE_OF_TABLE_AND_CAPTION_PERTINENCE_MSG,
                    // evidence element
                    TEXT_ELEMENT2)
            );
    }

    @Override
    protected void select(SSPHandler sspHandler) {
        super.select(sspHandler);
        
        // once tables selected, we extract the caption child element of each 
        // to make the control
        Elements captionOnTable = new Elements();
        for (Element el : getSelectionWithoutMarkerHandler().get()) {
            captionOnTable.add(el.select(CAPTION_ELEMENT).first());
        }
        getSelectionWithoutMarkerHandler().clean().addAll(captionOnTable);
        
        Elements captionOnDataTable = new Elements();
        for (Element el : getSelectionWithMarkerHandler().get()) {
            captionOnDataTable.add(el.select(CAPTION_ELEMENT).first());
        }
        getSelectionWithMarkerHandler().clean().addAll(captionOnDataTable);
    }
    
}